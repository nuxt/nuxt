import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextFrame, waitForPaint, yieldToMain } from '../src/app/internal/yield'

const flushMicrotasks = () => new Promise<void>(resolve => queueMicrotask(resolve))

function track (promise: Promise<void>) {
  const state = { settled: false }
  promise.then(() => { state.settled = true })
  return state
}

let frames: Array<() => void>
let paints: PerformanceEntry[]

beforeEach(() => {
  frames = []
  paints = []
  vi.useFakeTimers()
  vi.stubGlobal('document', { visibilityState: 'visible' })
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb))
  vi.stubGlobal('window', { performance: { getEntriesByType: (type: string) => type === 'paint' ? paints : [] } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('yieldToMain', () => {
  it('should resolve in a later task', async () => {
    const state = track(yieldToMain())
    await flushMicrotasks()
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.settled).toBe(true)
  })

  it('should not yield when the document is hidden', async () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' })
    const state = track(yieldToMain())
    await flushMicrotasks()
    expect(state.settled).toBe(true)
  })
})

describe('nextFrame', () => {
  it('should resolve in a task after the next frame', async () => {
    paints.push({ name: 'first-contentful-paint' } as PerformanceEntry)
    const state = track(nextFrame())
    await vi.advanceTimersByTimeAsync(50)
    expect(frames).toHaveLength(1)
    expect(state.settled).toBe(false)

    frames[0]!()
    await flushMicrotasks()
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.settled).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('should resolve after the timeout when no frame is produced', async () => {
    const state = track(nextFrame())
    await vi.advanceTimersByTimeAsync(99)
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(state.settled).toBe(true)
  })

  it('should not wait for a frame when the document is hidden', async () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' })
    const state = track(nextFrame())
    await flushMicrotasks()
    expect(state.settled).toBe(true)
    expect(frames).toHaveLength(0)
  })
})

describe('waitForPaint', () => {
  it('should wait for a frame when nothing has painted', async () => {
    const state = track(waitForPaint())
    await vi.advanceTimersByTimeAsync(50)
    expect(frames).toHaveLength(1)
    expect(state.settled).toBe(false)
    frames[0]!()
    await vi.advanceTimersByTimeAsync(0)
    expect(state.settled).toBe(true)
  })

  it('should only yield a task when the document has already painted', async () => {
    paints.push({ name: 'first-contentful-paint' } as PerformanceEntry)
    const state = track(waitForPaint())
    await flushMicrotasks()
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.settled).toBe(true)
    expect(frames).toHaveLength(0)
  })

  it('should not wait for a frame when the document is hidden', async () => {
    vi.stubGlobal('document', { visibilityState: 'hidden' })
    const state = track(waitForPaint())
    await flushMicrotasks()
    expect(state.settled).toBe(true)
    expect(frames).toHaveLength(0)
  })
})
