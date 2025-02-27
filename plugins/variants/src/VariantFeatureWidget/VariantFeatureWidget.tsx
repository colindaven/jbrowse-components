/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import {
  Divider,
  Link,
  Paper,
  FormControlLabel,
  Checkbox,
  TextField,
  Typography,
} from '@material-ui/core'
import SimpleFeature, {
  SimpleFeatureSerialized,
} from '@jbrowse/core/util/simpleFeature'
import { DataGrid } from '@material-ui/data-grid'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import {
  FeatureDetails,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { getSession } from '@jbrowse/core/util'

function VariantSamples(props: any) {
  const [filter, setFilter] = useState<any>({})
  const [showFilters, setShowFilters] = useState(true)
  const { feature } = props

  const { samples = {} } = feature
  const preFilteredRows: any = Object.entries(samples)
  if (!preFilteredRows.length) {
    return null
  }
  const infoFields = ['sample', ...Object.keys(preFilteredRows[0][1])].map(
    field => ({
      field,
    }),
  )
  let error
  let rows = []
  const filters = Object.keys(filter)

  // catch some error thrown from regex
  // note: maps all values into a string, if this is not done rows are not
  // sortable by the data-grid
  try {
    rows = preFilteredRows
      .map((row: any) => ({
        ...Object.fromEntries(
          Object.entries(row[1]).map(entry => [entry[0], String(entry[1])]),
        ),
        sample: row[0],
        id: row[0],
      }))
      .filter((row: any) => {
        return filters.length
          ? filters.every(key => {
              const val = row[key]
              const currFilter = filter[key]
              return currFilter ? val.match(currFilter) : true
            })
          : true
      })
  } catch (e) {
    error = e
  }

  return (
    <BaseCard {...props} title="Samples">
      {error ? <Typography color="error">{`${error}`}</Typography> : null}

      <FormControlLabel
        control={
          <Checkbox
            checked={showFilters}
            onChange={() => setShowFilters(f => !f)}
          />
        }
        label="Show sample filters"
      />
      {showFilters ? (
        <>
          <Typography>
            These filters can use a plain text search or regex style query, e.g.
            in the genotype field, entering 1 will query for all genotypes that
            include the first alternate allele e.g. 0|1 or 1|1, entering
            [1-9]\d* will find any non-zero allele e.g. 0|2 or 2/33
          </Typography>
          {infoFields.map(({ field }) => {
            return (
              <TextField
                key={`filter-${field}`}
                placeholder={`Filter ${field}`}
                value={filter[field] || ''}
                onChange={event =>
                  setFilter({ ...filter, [field]: event.target.value })
                }
              />
            )
          })}
        </>
      ) : null}
      <div style={{ height: 600, width: '100%', overflow: 'auto' }}>
        <DataGrid
          rows={rows}
          columns={infoFields}
          rowHeight={20}
          headerHeight={25}
          disableColumnMenu
        />
      </div>
    </BaseCard>
  )
}

function BreakendPanel(props: {
  locStrings: string[]
  model: any
  feature: SimpleFeatureSerialized
}) {
  const { model, locStrings, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  let viewType: any
  try {
    viewType = pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // plugin not added
  }
  return (
    <BaseCard {...props} title="Breakends">
      <Typography>Link to linear view of breakend endpoints</Typography>
      <ul>
        {locStrings.map((locString, index) => {
          return (
            <li key={`${JSON.stringify(locString)}-${index}`}>
              <Link
                href="#"
                onClick={() => {
                  const { view } = model
                  if (view) {
                    view.navToLocString?.(locString)
                  } else {
                    session.notify(
                      'No view associated with this feature detail panel anymore',
                      'warning',
                    )
                  }
                }}
              >
                {`LGV - ${locString}`}
              </Link>
            </li>
          )
        })}
      </ul>
      {viewType ? (
        <>
          <Typography>
            Launch split views with breakend source and target
          </Typography>
          <ul>
            {locStrings.map((locString, index) => {
              return (
                <li key={`${JSON.stringify(locString)}-${index}`}>
                  <Link
                    href="#"
                    onClick={() => {
                      const { view } = model
                      // @ts-ignore
                      const viewSnapshot = viewType.snapshotFromBreakendFeature(
                        new SimpleFeature(feature),
                        view,
                      )
                      viewSnapshot.views[0].offsetPx -= view.width / 2 + 100
                      viewSnapshot.views[1].offsetPx -= view.width / 2 + 100
                      viewSnapshot.featureData = feature
                      session.addView('BreakpointSplitView', viewSnapshot)
                    }}
                  >
                    {`${feature.refName}:${feature.start} // ${locString} (split view)`}
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </BaseCard>
  )
}

function VariantFeatureDetails(props: any) {
  const { model } = props
  const feat = JSON.parse(JSON.stringify(model.featureData))
  const { samples, ...rest } = feat
  const descriptions = {
    CHROM: 'chromosome: An identifier from the reference genome',
    POS:
      'position: The reference position, with the 1st base having position 1',
    ID:
      'identifier: Semi-colon separated list of unique identifiers where available',
    REF:
      'reference base(s): Each base must be one of A,C,G,T,N (case insensitive).',
    ALT:
      ' alternate base(s): Comma-separated list of alternate non-reference alleles',
    QUAL: 'quality: Phred-scaled quality score for the assertion made in ALT',
    FILTER:
      'filter status: PASS if this position has passed all filters, otherwise a semicolon-separated list of codes for filters that fail',
  }

  return (
    <Paper data-testid="variant-side-drawer">
      <FeatureDetails feature={rest} descriptions={descriptions} {...props} />
      <Divider />
      {feat.type === 'breakend' ? (
        <BreakendPanel
          feature={feat}
          locStrings={feat.ALT.map((alt: any) => alt.MatePosition)}
          model={model}
        />
      ) : null}
      {feat.type === 'translocation' ? (
        <BreakendPanel
          feature={feat}
          model={model}
          locStrings={[`${feat.INFO.CHR2[0]}:${feat.INFO.END}`]}
        />
      ) : null}
      <VariantSamples feature={feat} {...props} />
    </Paper>
  )
}

export default observer(VariantFeatureDetails)
