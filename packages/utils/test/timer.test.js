import { timeout, waitFor, Timer } from '../src/timer'

describe('util: timer', () => {
  test('timeout (promise)', async () => {
    const result = await timeout(Promise.resolve('time not run out'), 100)
    expect(result).toBe('time not run out')
  })

  test('timeout (async function)', async () => {
    const result = await timeout(async () => {
      await waitFor(10)
      return 'time not run out'
    }, 100)
    expect(result).toBe('time not run out')
  })

  test('timeout (timeout in 100ms)', async () => {
    const call = timeout(waitFor(200), 100, 'timeout test 100ms')
    await expect(call).rejects.toThrow('timeout test 100ms')
  })

  test('timeout (async timeout in 100ms)', async () => {
    const call = timeout(async () => {
      await waitFor(500)
    }, 100, 'timeout test 100ms')
    await expect(call).rejects.toThrow('timeout test 100ms')
  })

  test('waitFor', async () => {
    const delay = 100
    const s = process.hrtime()
    await waitFor(delay)
    const t = process.hrtime(s)
    // Node.js makes no guarantees about the exact timing of when callbacks will fire
    // HTML5 specifies a minimum delay of 4ms for timeouts
    // although arbitrary, use this value to determine our lower limit
    expect((t[0] * 1e9 + t[1]) / 1e6).not.toBeLessThan(delay - 4)
    await waitFor()
  })

  describe('util: timer Timer', () => {
    beforeAll(() => {
      // jest.spyOn()
    })

    test('should construct Timer', () => {
      const timer = new Timer()
      expect(timer._times).toBeInstanceOf(Map)
    })

    test('should create new time record', () => {
      const timer = new Timer()
      timer.hrtime = jest.fn(() => 'hrtime')

      const time = timer.start('test', 'test Timer')

      expect(timer.hrtime).toBeCalledTimes(1)
      expect(time).toEqual({ description: 'test Timer', name: 'test', start: 'hrtime' })
    })

    test('should stop and remove time record', () => {
      const timer = new Timer()
      timer.hrtime = jest.fn(() => 'hrtime')
      timer.start('test', 'test Timer')

      const time = timer.end('test')

      expect(timer._times.size).toEqual(0)
      expect(timer.hrtime).toBeCalledTimes(2)
      expect(timer.hrtime).nthCalledWith(2, 'hrtime')
      expect(time).toEqual({ description: 'test Timer', name: 'test', duration: 'hrtime', start: 'hrtime' })
    })

    test('should be quiet if end with nonexistent time', () => {
      const timer = new Timer()

      const time = timer.end('test')

      expect(time).toBeUndefined()
    })
  })
})
