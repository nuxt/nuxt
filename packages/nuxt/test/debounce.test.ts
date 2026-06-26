import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useDebounce } from '../src/app/composables/debounce'

describe('useDebounce', () => {
  // --- Happy path ---

  it('returns initial value immediately from ref', () => {
    const value = ref('initial')
    const debounced = useDebounce(value)

    expect(debounced.value).toBe('initial')
  })

  it('returns initial value immediately from getter', () => {
    const debounced = useDebounce(() => 'from-getter')

    expect(debounced.value).toBe('from-getter')
  })

  it('updates debounced value after specified delay', async () => {
    vi.useFakeTimers()
    const value = ref('a')
    const debounced = useDebounce(value, 200)

    value.value = 'b'
    await nextTick()
    vi.advanceTimersByTime(200)

    expect(debounced.value).toBe('b')

    vi.useRealTimers()
  })

  // --- Negative ---

  it('does not update debounced value before the delay elapses', async () => {
    vi.useFakeTimers()
    const value = ref('first')
    const debounced = useDebounce(value, 300)

    value.value = 'second'
    await nextTick()
    // advance only 100ms — below the 300ms threshold
    vi.advanceTimersByTime(100)

    expect(debounced.value).toBe('first')

    vi.useRealTimers()
  })

  // --- Edge cases ---

  it('updates immediately when ms is 0', async () => {
    vi.useFakeTimers()
    const value = ref('a')
    const debounced = useDebounce(value, 0)

    value.value = 'b'
    await nextTick()
    vi.advanceTimersByTime(0)

    expect(debounced.value).toBe('b')

    vi.useRealTimers()
  })

  it('applies only the last value from multiple rapid changes', async () => {
    vi.useFakeTimers()
    const value = ref(0)
    const debounced = useDebounce(value, 200)

    // t=0: set value=1, timer scheduled for t=200
    value.value = 1
    await nextTick()

    // t=50: set value=2, timer reset for t=250
    vi.advanceTimersByTime(50)
    value.value = 2
    await nextTick()

    // t=100: set value=3, timer reset for t=300
    vi.advanceTimersByTime(50)
    value.value = 3
    await nextTick()

    // t=150: still within debounce window (last timer fires at t=300)
    vi.advanceTimersByTime(50)
    expect(debounced.value).toBe(0)

    // t=300: last timer fires (need 150 more ms from t=150)
    vi.advanceTimersByTime(150)
    expect(debounced.value).toBe(3)

    vi.useRealTimers()
  })

  it('cleans up timeout on watch re-trigger (debounce resets)', async () => {
    vi.useFakeTimers()
    const value = ref('a')
    const debounced = useDebounce(value, 200)

    value.value = 'b'
    await nextTick()
    vi.advanceTimersByTime(100)

    // Change again before timeout fires — should reset the timer
    value.value = 'c'
    await nextTick()

    // At 200ms from first change, but 100ms from second change
    // Should still be at first value because timer was reset
    vi.advanceTimersByTime(100)

    expect(debounced.value).toBe('a')

    // Now 200ms from last change
    vi.advanceTimersByTime(100)
    expect(debounced.value).toBe('c')

    vi.useRealTimers()
  })

  it('uses default delay of 200ms when ms is not provided', async () => {
    vi.useFakeTimers()
    const value = ref('a')
    const debounced = useDebounce(value)

    value.value = 'b'
    await nextTick()
    vi.advanceTimersByTime(200)

    expect(debounced.value).toBe('b')

    vi.useRealTimers()
  })

  it('supports getter functions that return dynamic values', async () => {
    vi.useFakeTimers()
    const count = ref(0)
    const debounced = useDebounce(() => count.value, 100)

    // Initial value from getter
    expect(debounced.value).toBe(0)

    count.value = 5
    await nextTick()
    vi.advanceTimersByTime(100)

    expect(debounced.value).toBe(5)

    vi.useRealTimers()
  })
})
