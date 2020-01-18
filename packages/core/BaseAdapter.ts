import { Observer, Observable, merge } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { IRegion as Region } from './mst-types'
import { ObservableCreate } from './util/rxjs'
import { checkAbortSignal, observeAbortSignal } from './util'
import { Feature } from './util/simpleFeature'

export interface BaseOptions {
  signal?: AbortSignal
  bpPerPx?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface SampleInfo {
  refName: string,
  sampleStart: number,
  sampleEnd: number,
}
export interface Results{
  scoreMin: number,
  scoreMax: number,
}
export interface InnerRegion{
  refName: string,
  start: number,
  end: number,
  assemblyName: string,
  key: string,
  parentRegion: {
    refName: string,
    start: number,
    end: number,
    assemblyName: string
  },
  offsetPx: number,
  isLeftEndOfDisplayedRegion: boolean,
  isRightEndOfDisplayedRegion: boolean,
  widthPx: number
}

/**
 * Base class for adapters to extend. Defines some methods that subclasses must
 * implement.
 */
export default abstract class BaseAdapter {
  // List of all possible capabilities. Don't un-comment them here.
  // Example:
  // const capabilities = [
  // 'getFeatures',
  // 'getRefNames',
  // 'getRegions',
  // 'getRefNameAliases',
  // ]
  public static capabilities: string[]

  /**
   * Subclasses should override this method. Method signature here for reference.
   * @returns {Promise<string[]>} Array of reference sequence names used by the
   * source being adapted.
   *
   * Subclass method should look something like this:
   * await this.setup()
   * const { refNames } = this.metadata
   *
   * NOTE: if an adapter is unable to get it's own list of ref names, return empty
   *
   */
  public abstract async getRefNames(opts?: BaseOptions): Promise<string[]>

  /**
   * Subclasses should override this method. Method signature here for reference.
   *
   * Subclass method should look something like this:
   *    return ObservableCreate(observer => {
   *      const records = getRecords(assembly, refName, start, end)
   *      records.forEach(record => {
   *        observer.next(this.recordToFeature(record))
   *      })
   *      observer.complete()
   *    })
   * @param {Region} region
   * @param {BaseOptions} options
   * @returns {Observable[Feature]} Observable of Feature objects in the region
   */
  public abstract getFeatures(
    region: Region,
    opts: BaseOptions,
  ): Observable<Feature>

  /**
   * Subclasses should override this method. Method signature here for reference.
   *
   * called to provide a hint that data tied to a certain region
   * will not be needed for the forseeable future and can be purged
   * from caches, etc
   * @param {Region} region
   */
  public abstract freeResources(region: Region): void

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   * @param {Region} region see getFeatures()
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} see getFeatures()
   */
  public getFeaturesInRegion(
    region: Region,
    opts: BaseOptions = {},
  ): Observable<Feature> {
    return ObservableCreate(async (observer: Observer<Feature>) => {
      const hasData = await this.hasDataForRefName(region.refName, opts)
      checkAbortSignal(opts.signal)
      if (!hasData) {
        // console.warn(`no data for ${region.refName}`)
        observer.complete()
      } else {
        this.getFeatures(region, opts)
          .pipe(takeUntil(observeAbortSignal(opts.signal)))
          .subscribe(observer)
      }
    })
  }

  /**
   * Gathers a sample start and end region so adapter can grab records
   * By calculating a sample center using reference start and end
   * Then generating a start and end depending on current length
   * Used to get a general estimate of feature density,
   * @param {InnerRegion} region entry of regions
   * @param {Number} length range of features to sample
   * @returns {SampleInfo} start and end range to gather records for
   */
  public async generateSample(
    region: InnerRegion,
    length: number,
  ): Promise<SampleInfo>{
    const { refName, start, end } = region
    const sampleCenter = start * 0.75 + end * 0.25

    return {
      refName,
      sampleStart: Math.max(0, Math.round(sampleCenter - length / 2)),
      sampleEnd: Math.max(Math.round(sampleCenter + length / 2), end),
    }
  }

  /**
   * Calculates stats by summing feature density in each record
   * Used in conjuction with generateSample()
   * Return truthy value if enough records sampled for good estimate
   * Else return 0 as a falsy value
   * @param {Number} start sampleStart value from generateSample()
   * @param {Number} end sampleEnd value from generateSample()
   * @param {InnerRegion} region see generateSample()
   * @param {Array<any>} records records receieved from start to end range
   * @param {Number} length see generateSample()
   * @returns {Results} stats from summing all feature densities
   */
  public async calculateDensity(
    start: number,
    end: number,
    regions: InnerRegion,
    records: Array<any>,
    length: number,
  ): Promise<Results> {
    let results = new Array

    records.forEach(function iterate(feature, index) {
      if (feature.get('start') < start || feature.get('end') > end) return
      results.push({
        featureDensity: feature.get('length_on_ref') / length
      })
    })

    if (results.length >= 300 || length * 2 > regions.parentRegion.end - regions.parentRegion.start) {
      const total = results.reduce((a, b) => a + (b['featureDensity'] || 0), 0)
      return {scoreMin: 0, scoreMax: Math.ceil(total * 2)}
    }
    else return {scoreMin: 0, scoreMax: 0}
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters
   * that are frequently called on multiple regions simultaneously may
   * want to implement a more efficient custom version of this method.
   *
   * @param {[Region]} regions see getFeatures()
   * @param {AbortSignal} [signal] optional AbortSignal for aborting the request
   * @returns {Observable[Feature]} see getFeatures()
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ): Observable<Feature> {
    const obs = merge(
      ...regions.map(region => this.getFeaturesInRegion(region, opts)),
    )

    if (opts.signal) return obs.pipe(takeUntil(observeAbortSignal(opts.signal)))
    return obs
  }

  /**
   * Check if the store has data for the given reference name. Also checks the
   * assembly name if one was specified in the initial adapter config.
   * @param {string} refName Name of the reference sequence
   * @returns {Promise<boolean>} Whether data source has data for the given
   * reference name
   */
  public async hasDataForRefName(
    refName: string,
    opts: BaseOptions = {},
  ): Promise<boolean> {
    const refNames = await this.getRefNames(opts)
    if (refNames.includes(refName)) return true
    return false
  }
}

export interface Alias {
  refName: string
  aliases: string[]
}
export abstract class BaseRefNameAliasAdapter {
  public static capabilities: string[]

  public abstract async getRefNameAliases(): Promise<Alias[]>

  public abstract async freeResources(): Promise<void>
}
