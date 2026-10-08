import { readFileSync } from 'node:fs'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useDocumentStore } from '../../state/documentStore'
import { resetStores } from '../../test/resetStores'
import { ImportPanel } from './ImportPanel'

const file = (name: string, type = 'image/svg+xml') =>
  new File([readFileSync(`tests/fixtures/svg/${name}`)], name, { type })
const doc = () => useDocumentStore.getState()

beforeEach(() => {
  resetStores()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('ImportPanel', () => {
  test('importing a valid SVG through the file input applies a generated function', async () => {
    render(<ImportPanel guard={(action) => action()} onApplied={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('选择 SVG 文件'), file('single-path.svg'))
    await waitFor(() => expect(doc().history.present.presentationMode).toBe('drawing2d'))
    expect(doc().history.present.components.length).toBeGreaterThan(5)
  })

  test('dropping a file works too, and a multi-path file shows the warning', async () => {
    render(<ImportPanel guard={(action) => action()} onApplied={vi.fn()} />)
    const zone = screen.getByTestId('import-dropzone')
    fireEvent.drop(zone, { dataTransfer: { files: [file('multi-path.svg')] } })
    await waitFor(() => expect(doc().history.present.presentationMode).toBe('drawing2d'))
    expect(await screen.findByText(/最长/)).toBeInTheDocument()
  })

  test('an invalid file shows the reason and leaves the function alone', async () => {
    const before = doc().history.present
    render(<ImportPanel guard={(action) => action()} onApplied={vi.fn()} />)
    await userEvent.upload(
      screen.getByLabelText('选择 SVG 文件'),
      file('not-svg.txt', 'text/plain'),
      { applyAccept: false },
    )
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(doc().history.present).toBe(before)
  })

  test('the overwrite guard is consulted before applying', async () => {
    const guard = vi.fn()
    render(<ImportPanel guard={guard} onApplied={vi.fn()} />)
    await userEvent.upload(screen.getByLabelText('选择 SVG 文件'), file('single-path.svg'))
    await waitFor(() => expect(guard).toHaveBeenCalled())
    expect(doc().history.present.presentationMode).toBe('waveform')
  })
})
