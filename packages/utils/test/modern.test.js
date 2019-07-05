import { isModernRequest } from '../src/modern'

const createRequest = () => ({
  socket: {}, headers: {}
})

describe('utils: modern', () => {
  test('should not detect modern build if modern mode is specified', () => {
    const req = createRequest()

    isModernRequest(req)
    isModernRequest(req, 'client')
    isModernRequest(req, 'server')

    expect(req.socket._modern).toEqual(false)
  })

  test('should not detect modern browser if connect has been detected', () => {
    const req = createRequest()
    req.socket = { _modern: true }

    isModernRequest(req, 'server')

    expect(req.socket._modern).toEqual(true)
  })

  test('should detect modern browser based on user-agent', () => {
    const req = createRequest()
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
    req.headers['user-agent'] = ua
    req.socket = {}

    isModernRequest(req, 'server')

    expect(req.socket._modern).toEqual(true)
    expect(req.socket._modern).toEqual(true)
  })

  test('should detect legacy browser based on user-agent', () => {
    const req = createRequest()
    const ua = 'Mozilla/5.0 (Windows; U; MSIE 9.0; WIndows NT 9.0; en-US))'
    req.headers['user-agent'] = ua
    req.socket = {}

    isModernRequest(req, 'client')

    expect(req.socket._modern).toEqual(false)
  })

  test('should ignore illegal user-agent', () => {
    const req = createRequest()
    const ua = 'illegal user agent'
    req.headers['user-agent'] = ua
    req.socket = {}

    isModernRequest(req, 'client')

    expect(req.socket._modern).toEqual(false)
  })
})
