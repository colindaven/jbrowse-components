import React from 'react'
import { render } from 'react-testing-library'
import { createTestSession } from '@gmod/jbrowse-web/src/jbrowseModel'
import HierarchicalTrackSelector from './HierarchicalTrackSelector'

describe('HierarchicalTrackSelector drawer widget', () => {
  it('renders with just the required model elements', () => {
    const session = createTestSession()
    const firstView = session.addView('LinearGenomeView')
    session.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelector',
    )
    const model = session.drawerWidgets.get('hierarchicalTrackSelector')
    model.setView(firstView)

    const { container } = render(
      <HierarchicalTrackSelector model={model} session={session} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with a couple of uncategorized tracks', () => {
    const session = createTestSession({
      assemblies: [
        {
          assemblyName: 'volvox',
          sequence: {
            adapter: {
              type: 'FromConfigAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 10,
                  seq: 'cattgttgcg',
                },
              ],
            },
          },
          tracks: [
            {
              configId: 'fooC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
            {
              configId: 'barC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
          ],
        },
      ],
    })
    const firstView = session.addLinearGenomeViewOfAssembly('volvox', {})
    firstView.showTrack(session.configuration.assemblies[0].tracks[0])
    firstView.showTrack(session.configuration.assemblies[0].tracks[1])
    session.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelector',
      { view: firstView },
    )
    const model = session.drawerWidgets.get('hierarchicalTrackSelector')
    model.setView(firstView)

    const { container } = render(
      <HierarchicalTrackSelector model={model} session={session} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })

  it('renders with a couple of categorized tracks', () => {
    const session = createTestSession({
      assemblies: [
        {
          assemblyName: 'volvox',
          sequence: {
            adapter: {
              type: 'FromConfigAdapter',
              features: [
                {
                  refName: 'ctgA',
                  uniqueId: 'firstId',
                  start: 0,
                  end: 10,
                  seq: 'cattgttgcg',
                },
              ],
            },
          },
          tracks: [
            {
              configId: 'fooC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
            {
              configId: 'barC',
              type: 'BasicTrack',
              adapter: { type: 'FromConfigAdapter', features: [] },
            },
          ],
        },
      ],
    })
    const firstView = session.addLinearGenomeViewOfAssembly('volvox', {})
    firstView.showTrack(session.configuration.assemblies[0].tracks[0])
    firstView.showTrack(session.configuration.assemblies[0].tracks[1])
    firstView.tracks[0].configuration.category.set(['Foo Category'])
    firstView.tracks[1].configuration.category.set([
      'Foo Category',
      'Bar Category',
    ])
    session.addDrawerWidget(
      'HierarchicalTrackSelectorDrawerWidget',
      'hierarchicalTrackSelector',
      { view: firstView },
    )
    const model = session.drawerWidgets.get('hierarchicalTrackSelector')
    model.setView(firstView)

    const { container } = render(
      <HierarchicalTrackSelector model={model} session={session} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
