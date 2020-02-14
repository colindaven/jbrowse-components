import { Feature } from '@gmod/jbrowse-core/util/simpleFeature'

interface FeatureData {
  [key: string]: unknown
  refName: string
  start: number
  end: number
  type: string
}

export default class GDCFeature implements Feature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gdcObject: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parser: any

  private data: FeatureData

  private uniqueId: string

  private featureType: string

  private GDC_LINK = 'https://portal.gdc.cancer.gov/ssms/'

  private COSMIC_LINK = 'https://cancer.sanger.ac.uk/cosmic/mutation/overview?id='

  constructor(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gdcObject: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parser: any
    id: string
    featureType: string
  }) {
    this.gdcObject = args.gdcObject
    this.gdcObject.ssm_id = this.convertStringToLink(
      this.gdcObject.ssm_id,
      this.gdcObject.ssm_id,
      this.GDC_LINK,
    )
    this.gdcObject.cosmic_id = this.convertCosmicIdsToLinks(
      this.gdcObject.cosmic_id,
    )
    this.parser = args.parser
    this.featureType = args.featureType ? args.featureType : 'mutation'
    this.data = this.dataFromGDCObject(this.gdcObject, this.featureType)
    this.uniqueId = args.id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(field: string): any {
    return this.gdcObject[field] || this.data[field]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(name: string, val: any): void {}

  parent(): undefined {
    return undefined
  }

  children(): undefined {
    return undefined
  }

  tags(): string[] {
    const t = [...Object.keys(this.data), ...Object.keys(this.gdcObject)]
    return t
  }

  id(): string {
    return this.uniqueId
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataFromGDCObject(gdcObject: any, featureType: string): FeatureData {
    // Defaults to mutation values
    const featureData: FeatureData = {
      refName: gdcObject.chromosome,
      type: gdcObject.mutation_type,
      start: gdcObject.start_position,
      end: gdcObject.end_position,
    }

    switch (featureType) {
      case 'gene': {
        featureData.start = gdcObject.gene_start
        featureData.end = gdcObject.gene_end
        featureData.refName = gdcObject.gene_chromosome
        featureData.type = gdcObject.biotype
        break
      }
    }

    return featureData
  }

  convertStringToLink(id: string, name: string, url: string): string {
    return `<a href="${url}${id}" target="_blank">${name}</a>`
  }

  convertCosmicIdsToLinks(cosmic: string[]): string {
    if (cosmic) {
      const cosmicLinks: string[] = []
      for (const cosmicId of cosmic) {
        let cosmicIdNoPrefix = cosmicId.replace('COSM', '')
        cosmicIdNoPrefix = cosmicIdNoPrefix.replace('COSN', '')
        cosmicLinks.push(
          this.convertStringToLink(
            cosmicIdNoPrefix,
            cosmicIdNoPrefix,
            this.COSMIC_LINK,
          ),
        )
      }

      if (cosmicLinks.length > 0) {
        return cosmicLinks.join(', ')
      }
    }
    return 'n/a'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return {
      uniqueId: this.uniqueId,
      ...this.data,
      ...this.gdcObject,
    }
  }
}
