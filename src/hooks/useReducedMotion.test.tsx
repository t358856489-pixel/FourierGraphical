import { act, render, screen } from '@testing-library/react'
import { prefersReducedMotion, useReducedMotion } from './useReducedMotion'

function Harness() {
  return <p>{useReducedMotion() ? 'reduced' : 'full'}</p>
}

const stubMatchMedia = (initial: boolean) => {
  let matches = initial
  let listener: (() => void) | null = null
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches
    },
    addEventListener: (_: string, callback: () => void) => {
      listener = callback
    },
    removeEventListener: () => {
      listener = null
    },
  }))
  return (next: boolean) => {
    matches = next
    listener?.()
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('useReducedMotion', () => {
  test('reads the media query', () => {
    stubMatchMedia(true)
    render(<Harness />)
    expect(screen.getByText('reduced')).toBeInTheDocument()
    expect(prefersReducedMotion()).toBe(true)
  })

  test('follows changes to the preference', () => {
    const change = stubMatchMedia(false)
    render(<Harness />)
    act(() => change(true))
    expect(screen.getByText('reduced')).toBeInTheDocument()
  })

  test('defaults to full motion when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})
