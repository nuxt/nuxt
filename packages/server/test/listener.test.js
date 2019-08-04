import http from 'http'
import https from 'https'
import enableDestroy from 'server-destroy'
import ip from 'ip'
import consola from 'consola'
import pify from 'pify'

import Listener from '../src/listener'

jest.mock('http')
jest.mock('https')
jest.mock('server-destroy')
jest.mock('ip')
jest.mock('pify')

describe('server: listener', () => {
  const mockServer = () => {
    const server = {
      address: jest.fn(),
      on: jest.fn(),
      listen: jest.fn((listenArgs, callback) => {
        Promise.resolve().then(callback)
        return server
      }),
      destroy: jest.fn()
    }
    return server
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should construct listener', () => {
    const options = {
      port: 3000,
      host: 'localhost',
      socket: jest.fn(),
      https: { id: 'test-listener-https' },
      app: jest.fn(),
      dev: false
    }
    const listener = new Listener(options)

    expect(listener.port).toEqual(options.port)
    expect(listener.host).toEqual(options.host)
    expect(listener.socket).toEqual(options.socket)
    expect(listener.https).toEqual(options.https)
    expect(listener.app).toEqual(options.app)
    expect(listener.dev).toEqual(options.dev)
    expect(listener.listening).toEqual(false)
    expect(listener._server).toBe(null)
    expect(listener.server).toBe(null)
    expect(listener.address).toBe(null)
    expect(listener.url).toBe(null)
  })

  test('should listen http host and port', async () => {
    const server = mockServer()
    http.createServer.mockReturnValueOnce(server)

    const options = {
      port: 3000,
      host: 'localhost',
      https: false,
      app: jest.fn(),
      dev: false
    }
    const listener = new Listener(options)
    listener.computeURL = jest.fn()

    await listener.listen()

    expect(http.createServer).toBeCalledTimes(1)
    expect(http.createServer).toBeCalledWith(options.app)
    expect(server.on).toBeCalledTimes(1)
    expect(server.on).toBeCalledWith('error', expect.any(Function))
    expect(server.listen).toBeCalledTimes(1)
    expect(server.listen).toBeCalledWith(
      {
        host: options.host,
        port: options.port,
        exclusive: false
      },
      expect.any(Function)
    )
    expect(listener.server).toBe(server)
    expect(enableDestroy).toBeCalledTimes(1)
    expect(enableDestroy).toBeCalledWith(listener.server)
    expect(pify).toBeCalledTimes(1)
    expect(pify).toBeCalledWith(listener.server.destroy)
    expect(listener.computeURL).toBeCalledTimes(1)
    expect(listener.listening).toEqual(true)
  })

  test('should listen https host and port', async () => {
    const server = mockServer()
    https.createServer.mockReturnValueOnce(server)

    const options = {
      port: 3000,
      host: 'localhost',
      https: { key: 'test-listener' },
      app: jest.fn(),
      dev: false
    }
    const listener = new Listener(options)
    listener.computeURL = jest.fn()

    await listener.listen()

    expect(https.createServer).toBeCalledTimes(1)
    expect(https.createServer).toBeCalledWith(options.https, options.app)
    expect(server.on).toBeCalledTimes(1)
    expect(server.on).toBeCalledWith('error', expect.any(Function))
    expect(server.listen).toBeCalledTimes(1)
    expect(server.listen).toBeCalledWith(
      {
        host: options.host,
        port: options.port,
        exclusive: false
      },
      expect.any(Function)
    )
    expect(listener.server).toBe(server)
    expect(enableDestroy).toBeCalledTimes(1)
    expect(enableDestroy).toBeCalledWith(listener.server)
    expect(pify).toBeCalledTimes(1)
    expect(pify).toBeCalledWith(listener.server.destroy)
    expect(listener.computeURL).toBeCalledTimes(1)
    expect(listener.listening).toEqual(true)
  })

  test('should listen unix socket host and port', async () => {
    const server = mockServer()
    http.createServer.mockReturnValueOnce(server)

    const options = {
      port: 3000,
      host: 'localhost',
      https: false,
      socket: '/var/nuxt/unix.socket',
      app: jest.fn(),
      dev: false
    }
    const listener = new Listener(options)
    listener.computeURL = jest.fn()

    await listener.listen()

    expect(http.createServer).toBeCalledTimes(1)
    expect(http.createServer).toBeCalledWith(options.app)
    expect(server.on).toBeCalledTimes(1)
    expect(server.on).toBeCalledWith('error', expect.any(Function))
    expect(server.listen).toBeCalledTimes(1)
    expect(server.listen).toBeCalledWith(
      {
        path: options.socket,
        exclusive: false
      },
      expect.any(Function)
    )
    expect(listener.server).toBe(server)
    expect(enableDestroy).toBeCalledTimes(1)
    expect(enableDestroy).toBeCalledWith(listener.server)
    expect(pify).toBeCalledTimes(1)
    expect(pify).toBeCalledWith(listener.server.destroy)
    expect(listener.computeURL).toBeCalledTimes(1)
    expect(listener.listening).toEqual(true)
  })

  test('should prevent listening multiple times', async () => {
    const options = {
      port: 3000,
      host: 'localhost',
      https: false,
      app: jest.fn(),
      dev: false
    }
    const listener = new Listener(options)
    listener.computeURL = jest.fn()

    listener.listening = true
    await listener.listen()

    expect(http.createServer).not.toBeCalled()
  })

  test('should throw error if error occurred or listen failed', async () => {
    const server = mockServer()
    http.createServer.mockReturnValueOnce(server)

    const options = {
      port: 3000,
      host: 'localhost',
      https: false,
      app: jest.fn(),
      dev: false
    }
    const listener = new Listener(options)
    listener.computeURL = jest.fn()
    listener.serverErrorHandler = jest.fn()

    const serverError = new Error('error occurred')
    server.listen.mockImplementationOnce((listenArgs, callback) => {
      Promise.resolve().then(callback)
      const errorListener = server.on.mock.calls[0][1]
      errorListener(serverError)
      return server
    })
    await listener.listen()
    expect(listener.serverErrorHandler).toBeCalledTimes(1)
    expect(listener.serverErrorHandler).toBeCalledWith(serverError)

    http.createServer.mockReturnValueOnce(server)
    listener.serverErrorHandler.mockClear()

    const listenError = new Error('listen failed')
    server.listen.mockImplementationOnce((listenArgs, callback) => {
      Promise.resolve().then(() => callback(listenError))
      return server
    })
    await listener.listen()
    expect(listener.serverErrorHandler).toBeCalledTimes(1)
    expect(listener.serverErrorHandler).toBeCalledWith(listenError)
  })

  test('should compute http url', () => {
    const options = {
      port: 3000,
      host: 'localhost',
      baseURL: '/'
    }
    const listener = new Listener(options)
    listener.server = mockServer()

    listener.server.address.mockReturnValueOnce({
      address: 'localhost',
      port: 3000
    })
    listener.computeURL()
    expect(listener.host).toEqual('localhost')
    expect(listener.port).toEqual(3000)
    expect(listener.url).toEqual('http://localhost:3000/')

    listener.server.address.mockReturnValueOnce({
      address: '127.0.0.1',
      port: 3001
    })
    listener.computeURL()
    expect(listener.host).toEqual('localhost')
    expect(listener.port).toEqual(3001)
    expect(listener.url).toEqual('http://localhost:3001/')

    ip.address.mockReturnValueOnce('192.168.0.1')
    listener.server.address.mockReturnValueOnce({
      address: '0.0.0.0',
      port: 3002
    })
    listener.computeURL()
    expect(listener.host).toEqual('192.168.0.1')
    expect(listener.port).toEqual(3002)
    expect(listener.url).toEqual('http://192.168.0.1:3002/')
  })

  test('should compute https url', () => {
    const options = {
      port: 3000,
      host: 'localhost',
      https: true,
      baseURL: '/'
    }
    const listener = new Listener(options)
    listener.server = mockServer()

    listener.server.address.mockReturnValueOnce({
      address: 'localhost',
      port: 3000
    })
    listener.computeURL()
    expect(listener.host).toEqual('localhost')
    expect(listener.port).toEqual(3000)
    expect(listener.url).toEqual('https://localhost:3000/')

    listener.server.address.mockReturnValueOnce({
      address: '127.0.0.1',
      port: 3001
    })
    listener.computeURL()
    expect(listener.host).toEqual('localhost')
    expect(listener.port).toEqual(3001)
    expect(listener.url).toEqual('https://localhost:3001/')

    ip.address.mockReturnValueOnce('192.168.0.1')
    listener.server.address.mockReturnValueOnce({
      address: '0.0.0.0',
      port: 3002
    })
    listener.computeURL()
    expect(listener.host).toEqual('192.168.0.1')
    expect(listener.port).toEqual(3002)
    expect(listener.url).toEqual('https://192.168.0.1:3002/')
  })

  test('should compute unix socket url', () => {
    const options = {
      socket: true
    }
    const listener = new Listener(options)
    listener.server = mockServer()

    listener.server.address.mockReturnValueOnce('/var/nuxt/unix.socket')
    listener.computeURL()

    expect(listener.url).toEqual('unix+http:///var/nuxt/unix.socket')
  })

  test('should throw error in serverErrorHandler', () => {
    const listener = new Listener({})

    const error = new Error('server error')
    expect(listener.serverErrorHandler(error)).rejects.toThrow(error)
  })

  test('should throw address in use error', () => {
    const listener = new Listener({})
    listener.host = 'localhost'
    listener.port = 3000

    const addressInUse = new Error()
    addressInUse.code = 'EADDRINUSE'
    expect(listener.serverErrorHandler(addressInUse)).rejects.toThrow('Address `localhost:3000` is already in use.')
  })

  test('should throw address in use error for socket', () => {
    const listener = new Listener({})
    listener.socket = 'nuxt.socket'

    const addressInUse = new Error()
    addressInUse.code = 'EADDRINUSE'
    expect(listener.serverErrorHandler(addressInUse)).rejects.toThrow('Address `nuxt.socket` is already in use.')
  })

  test('should fallback to a random port in address in use error', async () => {
    const listener = new Listener({ dev: true })
    listener.host = 'localhost'
    listener.port = 3000
    listener.close = jest.fn(() => Promise.resolve())
    listener.listen = jest.fn()

    const addressInUse = new Error()
    addressInUse.code = 'EADDRINUSE'

    await listener.serverErrorHandler(addressInUse)

    expect(consola.warn).toBeCalledTimes(1)
    expect(consola.warn).toBeCalledWith('Address `localhost:3000` is already in use.')
    expect(consola.info).toBeCalledTimes(1)
    expect(consola.info).toBeCalledWith('Trying a random port...')
    expect(listener.port).toEqual('0')
    expect(listener.close).toBeCalledTimes(1)
    expect(listener.listen).toBeCalledTimes(1)
  })

  test('should reuse last random port', async () => {
    const listener = new Listener({ dev: true, host: 'localhost', port: 3000 })
    listener.host = 'localhost'
    listener.close = jest.fn()
    listener.listen = function () {
      if (this.port === '0') {
        this.port = Math.random()
      }
    }

    const addressInUse = new Error()
    addressInUse.code = 'EADDRINUSE'

    await listener.serverErrorHandler(addressInUse).catch(() => { })
    const port1 = listener.port
    await listener.serverErrorHandler(addressInUse).catch(() => { })
    const port2 = listener.port

    expect(port1).not.toBe(3000)
    expect(port2).toBe(port1)
  })

  test('should close server', async () => {
    const listener = new Listener({})
    const server = mockServer()
    listener.listening = true
    listener._server = server
    listener.server = server
    listener.server.listening = true
    listener.address = 'localhost'
    listener.url = 'http://localhost:3000'

    await listener.close()

    expect(server.destroy).toBeCalledTimes(1)
    expect(consola.debug).toBeCalledTimes(1)
    expect(consola.debug).toBeCalledWith('server closed')
    expect(listener.listening).toEqual(false)
    expect(listener._server).toBe(null)
    expect(listener.server).toBe(null)
    expect(listener.address).toBe(null)
    expect(listener.url).toBe(null)
  })

  test('should prevent destroying server if server is not listening', async () => {
    const listener = new Listener({})
    const server = mockServer()
    listener.listening = true
    listener._server = server
    listener.server = server
    listener.address = 'localhost'
    listener.url = 'http://localhost:3000'

    await listener.close()

    expect(server.destroy).not.toBeCalled()
    expect(consola.debug).not.toBeCalled()
    expect(listener.listening).toEqual(false)
    expect(listener._server).toBe(null)
    expect(listener.server).toBe(null)
    expect(listener.address).toBe(null)
    expect(listener.url).toBe(null)
  })
})
