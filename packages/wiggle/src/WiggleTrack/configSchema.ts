import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default (pluginManager: PluginManager) => {
  const XYPlotRendererConfigSchema = pluginManager.getRendererType(
    'XYPlotRenderer',
  ).configSchema
  const DensityRendererConfigSchema = pluginManager.getRendererType(
    'DensityRenderer',
  ).configSchema
  const LinePlotRendererConfigSchema = pluginManager.getRendererType(
    'LinePlotRenderer',
  ).configSchema

  return ConfigurationSchema(
    'WiggleTrack',
    {
      autoscale: {
        type: 'stringEnum',
        defaultValue: 'local',
        model: types.enumeration('Autoscale type', [
          'global',
          'local',
          'globalsd',
          'localsd',
          'zscore',
        ]),
        description:
          'global/local using their min/max values or w/ standard deviations (globalsd/localsd)',
      },
      minScore: {
        type: 'number',
        defaultValue: Number.MIN_VALUE,
        description: 'minimum value for the y-scale',
      },
      maxScore: {
        type: 'number',
        description: 'maximum value for the y-scale',
        defaultValue: Number.MAX_VALUE,
      },
      numStdDev: {
        type: 'number',
        description:
          'number of standard deviations to use for autoscale types globalsd or localsd',
        defaultValue: 3,
      },
      scaleType: {
        type: 'stringEnum',
        model: types.enumeration('Scale type', ['linear', 'log']), // todo zscale
        description: 'The type of scale to use',
        defaultValue: 'linear',
      },
      inverted: {
        type: 'boolean',
        description: 'draw upside down',
        defaultValue: false,
      },
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      defaultRendering: {
        type: 'stringEnum',
        model: types.enumeration('Rendering', ['density', 'xyplot', 'line']),
        defaultValue: 'xyplot',
      },

      renderers: ConfigurationSchema('RenderersConfiguration', {
        DensityRenderer: DensityRendererConfigSchema,
        XYPlotRenderer: XYPlotRendererConfigSchema,
        LinePlotRenderer: LinePlotRendererConfigSchema,
      }),
      mouseover: {
        type: 'string',
        description: 'what to display in the given mouseover',
        defaultValue: `function(feature) {
        return feature.get('score')
        }`,
        functionSignature: ['feature'],
      },
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}
