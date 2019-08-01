import {
  ConfigurationSchema,
  readConfObject,
} from '@gmod/jbrowse-core/configuration'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import RpcManager from '@gmod/jbrowse-core/rpc/RpcManager'
import { flow, getSnapshot, resolveIdentifier, types } from 'mobx-state-tree'
import shortid from 'shortid'
import corePlugins from './corePlugins'
import RenderWorker from './rpc.worker'
import * as rpcFuncs from './rpcMethods'
import AssemblyConfigSchemasFactory from './assemblyConfigSchemas'
import sessionModelFactory from './sessionModelFactory'

const pluginManager = new PluginManager(corePlugins.map(P => new P()))
pluginManager.configure()

const Session = sessionModelFactory(pluginManager)
const { assemblyConfigSchemas, dispatcher } = AssemblyConfigSchemasFactory(
  pluginManager,
)

const Dataset = ConfigurationSchema(
  'Dataset',
  {
    name: {
      type: 'string',
      defaultValue: '',
      description: 'Name of the dataset',
    },
    assembly: types.union({ dispatcher }, ...assemblyConfigSchemas),
    // track configuration is an array of track config schemas. multiple
    // instances of a track can exist that use the same configuration
    tracks: types.array(pluginManager.pluggableConfigSchemaType('track')),
    connections: types.array(
      pluginManager.pluggableConfigSchemaType('connection'),
    ),
  },
  {
    actions: self => ({
      addTrackConf(trackConf) {
        const { type } = trackConf
        if (!type) throw new Error(`unknown track type ${type}`)
        const length = self.tracks.push(trackConf)
        return self.tracks[length - 1]
      },
      addConnectionConf(connectionConf) {
        const { type } = connectionConf
        if (!type) throw new Error(`unknown connection type ${type}`)
        const length = self.connections.push(connectionConf)
        return self.connections[length - 1]
      },
    }),
  },
)

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

const JBrowseWeb = types
  .model('JBrowseWeb', {
    session: types.maybe(Session),
    sessionSnapshots: types.array(types.frozen(Session)),
    datasets: types.array(Dataset),
    configuration: ConfigurationSchema('Root', {
      rpc: RpcManager.configSchema,
      // possibly consider this for global config editor
      highResolutionScaling: {
        type: 'number',
        defaultValue: 2,
      },
    }),
  })
  .actions(self => ({
    addSessionSnapshot(sessionSnapshot) {
      const length = self.sessionSnapshots.push(sessionSnapshot)
      return self.sessionSnapshots[length - 1]
    },
    setSession(snapshot) {
      self.session = snapshot
    },
    setEmptySession() {
      self.setSession({
        name: `Unnamed Session ${shortid.generate()}`,
        menuBars: [{ type: 'MainMenuBar' }],
      })
    },
    activateSession(name) {
      const newSessionSnapshot = self.sessionSnapshots.find(
        sessionSnap => sessionSnap.name === name,
      )
      if (!newSessionSnapshot)
        throw new Error(
          `Can't activate session ${name}, it is not in the sessionSnapshots`,
        )
      self.setSession(newSessionSnapshot)
    },
    addDataset(datasetConf) {
      const length = self.datasets.push(datasetConf)
      return self.datasets[length - 1]
    },
  }))
  .views(self => ({
    get sessionNames() {
      return self.sessionSnapshots.map(sessionSnap => sessionSnap.name)
    },
  }))
  // Grouping the "assembly manager" stuff under an `extend` just for
  // code organization
  .extend(self => ({
    views: {
      get assemblyData() {
        const assemblyData = new Map()
        for (const datasetConfig of self.datasets) {
          const assemblyConfig = datasetConfig.assembly
          const assemblyName = readConfObject(assemblyConfig, 'name')
          const assemblyInfo = {}
          if (assemblyConfig.sequence)
            assemblyInfo.sequence = assemblyConfig.sequence
          const refNameAliasesConf = readConfObject(
            assemblyConfig,
            'refNameAliases',
          )
          if (refNameAliasesConf)
            assemblyInfo.refNameAliases = refNameAliasesConf
          const aliases = readConfObject(assemblyConfig, 'aliases')
          assemblyInfo.aliases = aliases
          assemblyData.set(assemblyName, assemblyInfo)
          aliases.forEach((assemblyAlias, idx) => {
            const newAliases = [
              ...aliases.slice(0, idx),
              ...aliases.slice(idx + 1),
              assemblyName,
            ]
            assemblyData.set(assemblyAlias, {
              ...assemblyInfo,
              aliases: newAliases,
            })
          })
        }
        for (const assemblyName of self.session.connections.keys()) {
          const connectionConfs = self.session.connections.get(assemblyName)
          // eslint-disable-next-line no-loop-func
          connectionConfs.forEach(connectionConf => {
            if (!assemblyData.has(assemblyName)) {
              const assemblyInfo = {}
              assemblyInfo.sequence = connectionConf.sequence
              assemblyInfo.refNameAliases = connectionConf.refNameAliases
              assemblyData.set(assemblyName, assemblyInfo)
            } else {
              if (
                !assemblyData.get(assemblyName).refNameAliases &&
                connectionConf.refNameAliases
              ) {
                assemblyData.get(assemblyName).refNameAliases = readConfObject(
                  connectionConf.refNameAliases,
                )
                assemblyData.get(assemblyName).aliases.forEach(alias => {
                  assemblyData.get(alias).refNameAliases = readConfObject(
                    connectionConf.refNameAliases,
                  )
                })
              }
              if (
                (!assemblyData.get(assemblyName).sequence &&
                  connectionConf.sequence) ||
                connectionConf.defaultSequence
              ) {
                assemblyData.get(assemblyName).sequence =
                  connectionConf.sequence
                assemblyData.get(assemblyName).aliases.forEach(alias => {
                  assemblyData.get(alias).sequence = connectionConf.sequence
                })
              }
            }
          })
        }
        return assemblyData
      },
    },
    actions: {
      getRefNameAliases: flow(function* getRefNameAliases(
        assemblyName,
        opts = {},
      ) {
        const refNameAliases = {}
        const assemblyConfig = self.assemblyData.get(assemblyName)
        if (assemblyConfig.refNameAliases) {
          const adapterRefNameAliases = yield self.rpcManager.call(
            assemblyConfig.refNameAliases.adapter.configId,
            'getRefNameAliases',
            {
              sessionId: assemblyName,
              adapterType: assemblyConfig.refNameAliases.adapter.type,
              adapterConfig: assemblyConfig.refNameAliases.adapter,
              signal: opts.signal,
            },
            { timeout: 1000000 },
          )
          adapterRefNameAliases.forEach(alias => {
            refNameAliases[alias.refName] = alias.aliases
          })
        }
        return refNameAliases
      }),

      addRefNameMapForAdapter: flow(function* addRefNameMapForAdapter(
        adapterConf,
        assemblyName,
        opts = {},
      ) {
        const adapterConfigId = readConfObject(adapterConf, 'configId')
        if (!self.refNameMaps.has(adapterConfigId))
          self.refNameMaps.set(adapterConfigId, new Map())
        const refNameMap = self.refNameMaps.get(adapterConfigId)

        const refNameAliases = yield self.getRefNameAliases(assemblyName, opts)

        const refNames = yield self.rpcManager.call(
          readConfObject(adapterConf, 'configId'),
          'getRefNames',
          {
            sessionId: assemblyName,
            adapterType: readConfObject(adapterConf, 'type'),
            adapterConfig: adapterConf,
            signal: opts.signal,
          },
          { timeout: 1000000 },
        )
        refNames.forEach(refName => {
          if (refNameAliases[refName])
            refNameAliases[refName].forEach(refNameAlias => {
              refNameMap.set(refNameAlias, refName)
            })
          else
            Object.keys(refNameAliases).forEach(configRefName => {
              if (refNameAliases[configRefName].includes(refName)) {
                refNameMap.set(configRefName, refName)
                refNameAliases[configRefName].forEach(refNameAlias => {
                  if (refNameAlias !== refName)
                    refNameMap.set(refNameAlias, refName)
                })
              }
            })
        })
        return refNameMap
      }),

      getRefNameMapForAdapter: flow(function* getRefNameMapForAdapter(
        adapterConf,
        assemblyName,
        opts = {},
      ) {
        const configId = readConfObject(adapterConf, 'configId')
        if (!self.refNameMaps.has(configId)) {
          return yield self.addRefNameMapForAdapter(
            adapterConf,
            assemblyName,
            opts,
          )
        }
        return self.refNameMaps.get(configId)
      }),
    },
  }))
  .volatile(self => ({
    rpcManager: new RpcManager(
      pluginManager,
      self.configuration.rpc,
      {
        WebWorkerRpcDriver: { WorkerClass: RenderWorker },
        MainThreadRpcDriver: { rpcFuncs },
      },
      self.getRefNameMapForAdapter,
    ),
    refNameMaps: new Map(),
  }))

export function createTestSession(snapshot = {}) {
  const jbrowseState = JBrowseWeb.create({
    configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
  })
  jbrowseState.setSession({
    name: 'testSession',
    menuBars: [{ type: 'MainMenuBar' }],
    ...snapshot,
  })
  return jbrowseState.session
}

export default JBrowseWeb
