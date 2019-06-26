import { renderToString } from 'react-dom/server'
import { filter, ignoreElements, tap } from 'rxjs/operators'
import { checkAbortSignal, iterMap } from '../../util'
import SimpleFeature from '../../util/simpleFeature'
import RendererType from './RendererType'
import SerializableFilterChain from './util/serializableFilterChain'

export default class ServerSideRenderer extends RendererType {
  deserializeResultsInClient(result /* , args */) {
    // deserialize some of the results that came back from the worker
    const featuresMap = new Map()
    result.features.forEach(j => {
      const f = SimpleFeature.fromJSON(j)
      featuresMap.set(String(f.id()), f)
    })
    result.features = featuresMap
    return result
  }

  /**
   * directly modifies the passed arguments object to
   * inflate arguments as necessary. called in the worker process.
   * @param {object} args the converted arguments to modify
   */
  deserializeArgsInWorker(args) {
    if (this.configSchema) {
      const config = this.configSchema.create(args.config || {})
      args.config = config
    }
  }

  /**
   *
   * @param {object} result object containing the results of calling the `render` method
   * @param {Map} features Map of feature.id() -> feature
   */
  serializeResultsInWorker(result, features) {
    result.features = iterMap(features.values(), f =>
      f.toJSON ? f.toJSON() : f,
    )
  }

  /**
   * Render method called on the client. Serializes args, then
   * calls `renderRegion` with the RPC manager.
   */
  async renderInClient(rpcManager, args) {
    const stateGroupName = args.sessionId
    const result = await rpcManager.call(stateGroupName, 'renderRegion', args)
    // const result = await renderRegionWithWorker(session, serializedArgs)

    this.deserializeResultsInClient(result, args)
    return result
  }

  /**
   * use the dataAdapter to fetch the features to be rendered
   *
   * @param {object} renderArgs
   * @returns {Map} of features as { id => feature, ... }
   */
  async getFeatures(renderArgs) {
    const { dataAdapter, region, signal, bpPerPx } = renderArgs
    const features = new Map()
    await dataAdapter
      .getFeaturesInRegion(
        {
          ...region,
          start: Math.floor(region.start),
          end: Math.ceil(region.end),
        },
        { signal, bpPerPx },
      )
      .pipe(
        tap(() => checkAbortSignal(signal)),
        filter(feature => this.featurePassesFilters(renderArgs, feature)),
        tap(feature => {
          const id = feature.id()
          if (!id) throw new Error(`invalid feature id "${id}"`)
          features.set(id, feature)
        }),
        ignoreElements(),
      )
      .toPromise()
    return features
  }

  /**
   * @param {object} renderArgs
   * @param {FeatureI} feature
   * @returns {boolean} true if this feature passes all configured filters
   */
  featurePassesFilters(renderArgs, feature) {
    const filterChain = new SerializableFilterChain({
      filters: renderArgs.filters,
    })
    return filterChain.passes(feature, renderArgs)
  }

  // render method called on the worker
  async renderInWorker(args) {
    this.deserializeArgsInWorker(args)

    checkAbortSignal(args.signal)

    const features = await this.getFeatures(args)
    const renderProps = { ...args, features }

    checkAbortSignal(args.signal)

    const results = await this.render({ ...renderProps, signal: args.signal })
    results.html = renderToString(results.element)
    delete results.element

    checkAbortSignal(args.signal)

    // serialize the results for passing back to the main thread.
    // these will be transmitted to the main process, and will come out
    // as the result of renderRegionWithWorker.
    this.serializeResultsInWorker(results, features, args)
    return results
  }
}
