import PluginManager from '@gmod/jbrowse-core/PluginManager'

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager
  const { types } = jbrequire('mobx-state-tree')

  // these types export the filter model and the column type so that they can
  // be subclasses
  const { NumberColumn: Number } = jbrequire(require('./Number'))
  const { TextColumn: Text } = jbrequire(require('./Text'))
  const { LocStringColumnType: LocString } = jbrequire(require('./LocString'))

  console.log({ LocString })

  // the rest that are jbrequired are not currently derivable from since they
  // don't export the filter model
  const ColumnTypes = {
    Number,
    Text,
    LocString,
    LocRef: jbrequire(require('./LocRef')),
    LocStart: jbrequire(require('./LocStart')),
    LocEnd: jbrequire(require('./LocEnd')),
    VcfLocString: jbrequire(require('./VcfLocString')),
  }

  const allColumnTypes = Object.values(ColumnTypes)
  const AnyColumnType = types.union(...allColumnTypes)

  return Object.freeze({
    ColumnTypes,
    AnyColumnType,
    // make a type union of all the different filter model types
    AnyFilterModelType: types.union(
      ...allColumnTypes
        .map(columnType => {
          // just instantiate the blank types to get their filter model types
          const { FilterModelType } = columnType.create({
            type: columnType.properties.type.value,
          })
          return FilterModelType
        })
        // some column types might not have filter machinery, filter those out
        .filter(t => !!t),
    ),
  })
}
