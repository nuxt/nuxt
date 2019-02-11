import set from 'lodash/set'
import IPMiddleware from '../../src/middleware/ip'

const mockReq = () => ({
  headers: [],
  connection: {},
  socket: {}
})

describe('ip middleware', () => {
  let middleware

  it('Create middleware', () => {
    middleware = IPMiddleware()
    expect(middleware).toBeInstanceOf(Function)
  })

  it('Calls next', () => {
    const next = jest.fn()
    middleware(mockReq(), undefined, next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('Prefer req.ip', () => {
    const ip = Math.random()
    const req = { ...mockReq(), ip }
    middleware(req, undefined, jest.fn())
    expect(req.ip).toBe(ip)
  })

  // Prepare all keys
  const keys = [
    'headers.x-real-ip',
    'connection.remoteAddress',
    'socket.remoteAddress',
    'connection.socket.remoteAddress'
  ]
  const req = mockReq()
  for (const key of keys) {
    set(req, key, 'IP_FROM_' + key)
  }

  // Test order
  for (const key of keys) {
    it('Use ' + key, () => {
      delete req.ip
      middleware(req, undefined, jest.fn())
      expect(req.ip).toBe('IP_FROM_' + key)
      set(req, key, undefined)
    })
  }
})
