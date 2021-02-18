import { toArray } from 'rxjs/operators'
import {
  freeAdapterResources,
  getAdapter,
} from '../data_adapters/dataAdapterCache'
import RpcMethodType from '../pluggableElementTypes/RpcMethodType'
import {
  rendererFactory,
  RenderArgsSerialized as RendererTypeRenderArgsSerialized,
} from '../pluggableElementTypes/renderers/ServerSideRendererType'
import { RemoteAbortSignal } from './remoteAbortSignals'
import {
  BaseFeatureDataAdapter,
  isFeatureAdapter,
} from '../data_adapters/BaseAdapter'
import { Region } from '../util/types'
import { checkAbortSignal, renameRegionsIfNeeded } from '../util'

export class CoreGetRefNames extends RpcMethodType {
  name = 'CoreGetRefNames'

  async execute(args: {
    sessionId: string
    signal: RemoteAbortSignal
    adapterConfig: {}
  }) {
    const deserializedArgs = await this.deserializeArguments(args)
    const { sessionId, adapterConfig } = deserializedArgs
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (dataAdapter instanceof BaseFeatureDataAdapter) {
      return dataAdapter.getRefNames(deserializedArgs)
    }
    return []
  }
}

export class CoreGetFileInfo extends RpcMethodType {
  name = 'CoreGetInfo'

  async execute(args: {
    sessionId: string
    signal: RemoteAbortSignal
    adapterConfig: {}
  }) {
    const deserializedArgs = await this.deserializeArguments(args)
    const { sessionId, adapterConfig } = deserializedArgs
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    return isFeatureAdapter(dataAdapter)
      ? dataAdapter.getHeader(deserializedArgs)
      : null
  }
}

export class CoreGetFeatures extends RpcMethodType {
  name = 'CoreGetFeatures'

  async execute(args: {
    sessionId: string
    signal: RemoteAbortSignal
    region: Region
    adapterConfig: {}
  }) {
    const deserializedArgs = await this.deserializeArguments(args)
    const { sessionId, adapterConfig, region } = deserializedArgs
    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (isFeatureAdapter(dataAdapter)) {
      const ret = dataAdapter.getFeatures(region)
      const feats = await ret.pipe(toArray()).toPromise()
      return JSON.parse(JSON.stringify(feats))
    }
    return []
  }
}

/**
 * free up any resources (e.g. cached adapter objects)
 * that are only associated with the given track ID.
 *
 * returns number of objects deleted
 */
export class CoreFreeResources extends RpcMethodType {
  name = 'CoreFreeResources'

  async execute(specification: {}) {
    let deleteCount = 0

    deleteCount += freeAdapterResources(specification)

    // pass the freeResources hint along to all the renderers as well
    this.pluginManager.getRendererTypes().forEach(renderer => {
      const count = renderer.freeResources(/* specification */)
      if (count) deleteCount += count
    })

    return deleteCount
  }
}

export interface RenderArgs {
  assemblyName: string
  regions: Region[]
  sessionId: string
  adapterConfig: {}
  rendererType: string
  renderProps: RendererTypeRenderArgsSerialized
}

/**
 * fetches features from an adapter and call a renderer with them
 */
export class CoreRender extends RpcMethodType {
  name = 'CoreRender'

  async serializeArguments(
    args: RenderArgs & { signal?: AbortSignal; statusCallback: Function },
  ) {
    const assemblyManager = this.pluginManager.rootModel?.session
      ?.assemblyManager
    if (!assemblyManager) {
      return args
    }

    return renameRegionsIfNeeded(assemblyManager, args)
  }

  async execute(args: RenderArgs & { signal?: RemoteAbortSignal }) {
    const deserializedArgs = await this.deserializeArguments(args)
    const {
      sessionId,
      adapterConfig,
      rendererType,
      renderProps,
      signal,
    } = deserializedArgs
    if (!sessionId) {
      throw new Error('must pass a unique session id')
    }

    checkAbortSignal(signal)

    const { dataAdapter } = getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!(dataAdapter instanceof BaseFeatureDataAdapter))
      throw new Error(
        `CoreRender cannot handle this type of data adapter ${dataAdapter}`,
      )

    const RendererType = validateRendererType(
      rendererType,
      this.pluginManager.getRendererType(rendererType),
    )

    const renderArgs = {
      ...deserializedArgs,
      ...renderProps,
      dataAdapter,
    }
    delete renderArgs.renderProps

    const result = await RendererType.renderInWorker(renderArgs)

    checkAbortSignal(signal)
    return result
  }
}

function validateRendererType<T>(rendererType: string, RendererType: T) {
  if (!RendererType) {
    throw new Error(`renderer "${rendererType}" not found`)
  }
  // @ts-ignore
  if (!RendererType.ReactComponent) {
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  }

  const ServerSideRendererType = rendererFactory()

  console.log(typeof ServerSideRendererType)
  if (!(RendererType instanceof ServerSideRendererType)) {
    throw new Error(
      'CoreRender requires a renderer that is a subclass of ServerSideRendererType',
    )
  }
  return RendererType
}
