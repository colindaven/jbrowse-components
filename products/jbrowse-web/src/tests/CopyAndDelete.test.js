// library
import '@testing-library/jest-dom/extend-expect'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { toMatchImageSnapshot } from 'jest-image-snapshot'
import React from 'react'
import { LocalFile } from 'generic-filehandle'

// locals
import { clearCache } from '@jbrowse/core/util/io/rangeFetcher'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import JBrowse from '../JBrowse'
import masterConfig from '../../test_data/volvox/connection_test.json'
import { setup, getPluginManager, generateReadBuffer } from './util'

expect.extend({ toMatchImageSnapshot })

masterConfig.configuration = {
  rpc: {
    defaultDriver: 'MainThreadRpcDriver',
  },
}

setup()
beforeEach(() => {
  clearCache()
  clearAdapterCache()
  fetch.resetMocks()
  fetch.mockResponse(
    generateReadBuffer(url => {
      return new LocalFile(require.resolve(`../../test_data/volvox/${url}`))
    }),
  )
})
afterEach(cleanup)
test('copy and delete track in admin mode', async () => {
  const pluginManager = getPluginManager(undefined, true)
  const state = pluginManager.rootModel
  const { findByTestId, queryByText, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
  fireEvent.click(await findByText('Copy track'))
  fireEvent.click(await findByText('volvox filtered vcf (copy)'))
  expect(queryByText(/Session tracks/)).toBeNull()
  await waitFor(() => expect(state.session.views[0].tracks.length).toBe(1))
  await findAllByTestId('box-test-vcf-604452', {}, { timeout: 10000 })
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await waitFor(() => expect(state.session.views[0].tracks.length).toBe(0))
})

test('copy and delete track to session tracks', async () => {
  const pluginManager = getPluginManager(undefined, false)
  const state = pluginManager.rootModel
  const { findByTestId, findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')
  state.session.views[0].setNewView(0.05, 5000)
  fireEvent.click(await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf'))
  fireEvent.click(await findByText('Copy track'))
  fireEvent.click(await findByText('volvox filtered vcf (copy)'))
  await findByText(/Session tracks/)
  await waitFor(() => expect(state.session.views[0].tracks.length).toBe(1))
  await findAllByTestId('box-test-vcf-604452', {}, { timeout: 10000 })
  fireEvent.click(await findByTestId('track_menu_icon'))
  fireEvent.click(await findByText('Delete track'))
  await waitFor(() => expect(state.session.views[0].tracks.length).toBe(0))
})

test('delete connection', async () => {
  const pluginManager = getPluginManager(masterConfig, true)
  const { findAllByTestId, findByText } = render(
    <JBrowse pluginManager={pluginManager} />,
  )
  await findByText('Help')

  const deleteButtons = await findAllByTestId('delete-connection')
  expect(deleteButtons.length).toBe(3)
  fireEvent.click(deleteButtons[0])
  fireEvent.click(await findByText('OK'))
  expect((await findAllByTestId('delete-connection')).length).toBe(2)
})
