import consola from 'consola'
import onHeaders from 'on-headers'
import { Timer } from '@nuxt/utils'

import createTimingMiddleware from '../../src/middleware/timing'

jest.mock('on-headers')
jest.mock('@nuxt/utils')

const createServerContext = () => ({
  req: {},
  res: {
    getHeader: jest.fn(),
    setHeader: jest.fn()
  },
  next: jest.fn()
})

describe('server: timingMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should return timing middleware', () => {
    const timingMiddleware = createTimingMiddleware({})
    expect(timingMiddleware).toBeInstanceOf(Function)
  })

  test('should warn duplicate registration', () => {
    const timingMiddleware = createTimingMiddleware({})
    const ctx = createServerContext()

    ctx.res.timing = true
    timingMiddleware(ctx.req, ctx.res, ctx.next)

    expect(consola.warn).toBeCalledWith('server-timing is already registered.')
  })

  test('should register timer for recording timing', () => {
    const timingMiddleware = createTimingMiddleware({ total: true })
    const ctx = createServerContext()

    timingMiddleware(ctx.req, ctx.res, ctx.next)

    expect(ctx.res.timing).toBeDefined()
    expect(Timer.prototype.start).toBeCalledTimes(1)
    expect(Timer.prototype.start).toBeCalledWith('total', 'Nuxt Server Time')
    expect(onHeaders).toBeCalledTimes(1)
    expect(onHeaders).toBeCalledWith(ctx.res, expect.any(Function))
    expect(ctx.next).toBeCalledTimes(1)
  })

  test('should add Server-Timing header before sending header', () => {
    const timingMiddleware = createTimingMiddleware({ total: true })
    const ctx = createServerContext()

    timingMiddleware(ctx.req, ctx.res, ctx.next)

    const headerCallback = onHeaders.mock.calls[0][1]
    Timer.prototype.end.mockReturnValueOnce({
      name: 'total',
      duration: 300,
      description: 'Nuxt Server Time'
    })
    headerCallback()

    expect(ctx.res.timing.end).toBeCalledTimes(1)
    expect(ctx.res.timing.end).toBeCalledWith('total')
    expect(ctx.res.getHeader).toBeCalledTimes(1)
    expect(ctx.res.getHeader).toBeCalledWith('Server-Timing')
    expect(ctx.res.setHeader).toBeCalledTimes(1)
    expect(ctx.res.setHeader).toBeCalledWith('Server-Timing', 'total;dur=300;desc="Nuxt Server Time"')
  })

  test('should ignore desc if empty', () => {
    const timingMiddleware = createTimingMiddleware({})
    const ctx = createServerContext()

    timingMiddleware(ctx.req, ctx.res, ctx.next)

    expect(
      ctx.res.timing.formatHeader({
        name: 'timing-test',
        duration: 300
      })
    ).toEqual('timing-test;dur=300')
  })

  test('should not send Server-Timing header if empty', () => {
    const timingMiddleware = createTimingMiddleware({ total: true })
    const ctx = createServerContext()

    timingMiddleware(ctx.req, ctx.res, ctx.next)

    const headerCallback = onHeaders.mock.calls[0][1]
    headerCallback()

    expect(ctx.res.timing.end).toBeCalledTimes(1)
    expect(ctx.res.timing.end).toBeCalledWith('total')
    expect(ctx.res.getHeader).not.toBeCalled()
    expect(ctx.res.setHeader).not.toBeCalled()
  })
})
