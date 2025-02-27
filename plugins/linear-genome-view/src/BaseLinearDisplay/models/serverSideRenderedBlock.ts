/* eslint-disable @typescript-eslint/no-explicit-any */
import { types, getParent, isAlive, cast, Instance } from 'mobx-state-tree'
import { Component } from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { Region } from '@jbrowse/core/util/types/mst'

import {
  assembleLocString,
  makeAbortableReaction,
  getSession,
  getContainingDisplay,
} from '@jbrowse/core/util'
import {
  getTrackAssemblyNames,
  getRpcSessionId,
} from '@jbrowse/core/util/tracks'

import ServerSideRenderedBlockContent from '../components/ServerSideRenderedBlockContent'

// the MST state of a single server-side-rendered block in a display
const blockState = types
  .model('BlockState', {
    key: types.string,
    region: Region,
    isLeftEndOfDisplayedRegion: false,
    isRightEndOfDisplayedRegion: false,
  })
  // NOTE: all this volatile stuff has to be filled in at once, so that it stays consistent
  .volatile(() => ({
    renderInProgress: undefined as AbortController | undefined,
    filled: false,
    data: undefined as any,
    html: '',
    status: '',
    error: undefined as Error | undefined,
    message: undefined as string | undefined,
    maxHeightReached: false,
    ReactComponent: ServerSideRenderedBlockContent,
    renderingComponent: undefined as any,
    renderProps: undefined as any,
  }))
  .actions(self => {
    let renderInProgress: undefined | AbortController
    return {
      afterAttach() {
        const display = getContainingDisplay(self)
        makeAbortableReaction(
          self as any,
          renderBlockData,
          renderBlockEffect as any, // reaction doesn't expect async here
          {
            name: `${display.id}/${assembleLocString(self.region)} rendering`,
            delay: display.renderDelay,
            fireImmediately: true,
          },
          this.setLoading,
          this.setRendered,
          this.setError,
        )
      },
      setStatus(message: string) {
        self.status = message
      },
      setLoading(abortController: AbortController) {
        if (renderInProgress !== undefined) {
          if (!renderInProgress.signal.aborted) {
            renderInProgress.abort()
          }
        }
        self.filled = false
        self.message = undefined
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.maxHeightReached = false
        self.renderingComponent = undefined
        self.renderProps = undefined
        renderInProgress = abortController
      },
      setMessage(messageText: string) {
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        self.filled = false
        self.message = messageText
        self.html = ''
        self.data = undefined
        self.error = undefined
        self.maxHeightReached = false
        self.renderingComponent = undefined
        self.renderProps = undefined
        renderInProgress = undefined
      },
      setRendered(
        props:
          | {
              data: any
              html: any
              maxHeightReached: boolean
              renderingComponent: Component
              renderProps: any
            }
          | undefined,
      ) {
        if (!props) {
          return
        }
        const {
          data,
          html,
          maxHeightReached,
          renderingComponent,
          renderProps,
        } = props
        self.filled = true
        self.message = undefined
        self.html = html
        self.data = data
        self.error = undefined
        self.maxHeightReached = maxHeightReached
        self.renderingComponent = renderingComponent
        self.renderProps = renderProps
        renderInProgress = undefined
      },
      setError(error: Error) {
        console.error(error)
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        // the rendering failed for some reason
        self.filled = false
        self.message = undefined
        self.html = ''
        self.data = undefined
        self.maxHeightReached = false
        self.error = error
        self.renderingComponent = undefined
        self.renderProps = undefined
        renderInProgress = undefined
      },
      reload() {
        self.renderInProgress = undefined
        self.filled = false
        self.data = undefined
        self.html = ''
        self.error = undefined
        self.message = undefined
        self.maxHeightReached = false
        self.ReactComponent = ServerSideRenderedBlockContent
        self.renderingComponent = undefined
        self.renderProps = undefined
        getParent(self, 2).reload()
      },
      beforeDestroy() {
        if (renderInProgress && !renderInProgress.signal.aborted) {
          renderInProgress.abort()
        }
        const display = getContainingDisplay(self)
        const { rpcManager } = getSession(self)
        const { rendererType } = display
        const { renderArgs } = renderBlockData(cast(self))
        // renderArgs can be undefined if an error occured in this block
        if (renderArgs) {
          rendererType
            .freeResourcesInClient(
              rpcManager,
              JSON.parse(JSON.stringify(renderArgs)),
            )
            .catch((e: Error) => {
              // just console.error if it's something while it's being destroyed
              console.warn('Error while destroying block', e)
            })
        }
      },
    }
  })

export default blockState
export type BlockStateModel = typeof blockState
export type BlockModel = Instance<BlockStateModel>
// calls the render worker to render the block content
// not using a flow for this, because the flow doesn't
// work with autorun
function renderBlockData(self: Instance<BlockStateModel>) {
  try {
    const { assemblyManager, rpcManager } = getSession(self)
    const display = getContainingDisplay(self) as any
    const {
      adapterConfig,
      renderProps,
      rendererType,
      error: displayError,
      parentTrack,
    } = display
    const assemblyNames = getTrackAssemblyNames(parentTrack)
    const regionAsm = self.region.assemblyName
    if (
      !assemblyNames.includes(regionAsm) &&
      !assemblyNames.find(name => assemblyManager.get(name)?.hasName(regionAsm))
    ) {
      throw new Error(
        `region assembly (${regionAsm}) does not match track assemblies (${assemblyNames})`,
      )
    }

    const { config } = renderProps
    // This line is to trigger the mobx reaction when the config changes
    // It won't trigger the reaction if it doesn't think we're accessing it
    readConfObject(config)

    const sessionId = getRpcSessionId(display)
    const cannotBeRenderedReason = display.regionCannotBeRendered(self.region)

    return {
      rendererType,
      rpcManager,
      renderProps,
      cannotBeRenderedReason,
      displayError,
      renderArgs: {
        statusCallback: (message: string) => {
          if (isAlive(self)) {
            self.setStatus(message)
          }
        },
        assemblyName: self.region.assemblyName,
        regions: [self.region],
        adapterConfig,
        rendererType: rendererType.name,
        sessionId,
        blockKey: self.key,
        timeout: 1000000, // 10000,
      },
    }
  } catch (e) {
    return { displayError: e }
  }
}

interface RenderProps {
  displayError: Error
  rendererType: any
  renderProps: { [key: string]: any }
  rpcManager: { call: Function }
  cannotBeRenderedReason: string
  renderArgs: { [key: string]: any }
}

interface ErrorProps {
  displayError: string
}

async function renderBlockEffect(
  props: RenderProps | ErrorProps,
  signal: AbortSignal,
  self: Instance<BlockStateModel>,
) {
  const {
    rendererType,
    renderProps,
    rpcManager,
    renderArgs,
    cannotBeRenderedReason,
    displayError,
  } = props as RenderProps

  if (!isAlive(self)) {
    return undefined
  }

  if (displayError) {
    self.setError(displayError)
    return undefined
  }
  if (cannotBeRenderedReason) {
    self.setMessage(cannotBeRenderedReason)
    return undefined
  }

  if (renderProps.notReady) {
    return undefined
  }

  const { html, maxHeightReached, ...data } = await rendererType.renderInClient(
    rpcManager,
    {
      ...renderArgs,
      ...renderProps,
      signal,
    },
  )
  return {
    data,
    html,
    maxHeightReached,
    renderingComponent: rendererType.ReactComponent,
    renderProps,
  }
}
