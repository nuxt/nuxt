import path from 'path'
import fs from 'fs-extra'
import consola from 'consola'

import Youch from '@nuxtjs/youch'

import createErrorMiddleware from '../../src/middleware/error'

jest.mock('path')
jest.mock('fs-extra')
jest.mock('@nuxtjs/youch', () => jest.fn(() => ({
  toHTML: jest.fn(() => 'youch html'),
  toJSON: jest.fn(() => 'youch json')
})))

const createParams = () => ({
  resources: { errorTemplate: jest.fn(() => 'error template') },
  options: {
    srcDir: '/var/nuxt/src',
    rootDir: '/var/nuxt',
    buildDir: '/var/nuxt/dist',
    router: { base: '/' }
  }
})

const createServerContext = () => ({
  req: { headers: {} },
  res: { setHeader: jest.fn(), end: jest.fn() },
  next: jest.fn()
})

describe('server: errorMiddleware', () => {
  beforeAll(() => {
    path.join.mockImplementation((...args) => `join(${args.join(', ')})`)
    path.resolve.mockImplementation((...args) => `resolve(${args.join(', ')})`)
    fs.readFile.mockImplementation(() => Promise.resolve())
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should return error middleware', () => {
    const errorMiddleware = createErrorMiddleware({})
    expect(errorMiddleware).toBeInstanceOf(Function)
  })

  test('should send html error response', async () => {
    const params = createParams()
    const errorMiddleware = createErrorMiddleware(params)
    const error = new Error()
    error.headers = { 'Custom-Header': 'test' }
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    expect(consola.error).toBeCalledWith(error)
    expect(ctx.res.statusCode).toEqual(500)
    expect(ctx.res.statusMessage).toEqual('NuxtServerError')
    expect(ctx.res.setHeader).toBeCalledTimes(4)
    expect(ctx.res.setHeader).nthCalledWith(1, 'Content-Type', 'text/html; charset=utf-8')
    expect(ctx.res.setHeader).nthCalledWith(2, 'Content-Length', Buffer.byteLength('error template'))
    expect(ctx.res.setHeader).nthCalledWith(3, 'Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
    expect(ctx.res.setHeader).nthCalledWith(4, 'Custom-Header', 'test')
    expect(params.resources.errorTemplate).toBeCalledTimes(1)
    expect(params.resources.errorTemplate).toBeCalledWith({
      status: 500,
      message: 'Nuxt Server Error',
      name: 'NuxtServerError'
    })
    expect(ctx.res.end).toBeCalledTimes(1)
    expect(ctx.res.end).toBeCalledWith('error template', 'utf-8')
  })

  test('should send json error response', async () => {
    const params = createParams()
    const errorMiddleware = createErrorMiddleware(params)
    const error = {
      statusCode: 404,
      name: 'NuxtTestError',
      message: 'test error'
    }
    const ctx = createServerContext()
    ctx.req.headers.accept = 'application/json'

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const errJson = JSON.stringify({
      status: error.statusCode,
      message: error.message,
      name: error.name
    }, undefined, 2)
    expect(consola.error).not.toBeCalled()
    expect(ctx.res.statusCode).toEqual(404)
    expect(ctx.res.statusMessage).toEqual(error.name)
    expect(ctx.res.setHeader).toBeCalledTimes(3)
    expect(ctx.res.setHeader).nthCalledWith(1, 'Content-Type', 'text/json; charset=utf-8')
    expect(ctx.res.setHeader).nthCalledWith(2, 'Content-Length', Buffer.byteLength(errJson))
    expect(ctx.res.setHeader).nthCalledWith(3, 'Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
    expect(params.resources.errorTemplate).not.toBeCalled()
    expect(ctx.res.end).toBeCalledTimes(1)
    expect(ctx.res.end).toBeCalledWith(errJson, 'utf-8')
  })

  test('should send html error response by youch in debug mode', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = new Error('test error')
    error.statusCode = 503
    error.name = 'NuxtTestError'
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const errHtml = 'youch html'
    expect(Youch).toBeCalledTimes(1)
    expect(Youch).toBeCalledWith(
      error,
      ctx.req,
      expect.any(Function),
      params.options.router.base,
      true
    )
    expect(ctx.res.statusCode).toEqual(503)
    expect(ctx.res.statusMessage).toEqual(error.name)
    expect(ctx.res.setHeader).toBeCalledTimes(3)
    expect(ctx.res.setHeader).nthCalledWith(1, 'Content-Type', 'text/html; charset=utf-8')
    expect(ctx.res.setHeader).nthCalledWith(2, 'Content-Length', Buffer.byteLength(errHtml))
    expect(ctx.res.setHeader).nthCalledWith(3, 'Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
    expect(params.resources.errorTemplate).not.toBeCalled()
    expect(ctx.res.end).toBeCalledTimes(1)
    expect(ctx.res.end).toBeCalledWith(errHtml, 'utf-8')
  })

  test('should send json error response by youch in debug mode', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {
      statusCode: 404,
      name: 'NuxtTestError',
      message: 'test error'
    }
    const ctx = createServerContext()
    ctx.req.headers.accept = 'application/json'

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const errJson = JSON.stringify('youch json', undefined, 2)
    const errorFull = new Error(error.message)
    errorFull.name = error.name
    errorFull.statusCode = error.statusCode
    errorFull.stack = undefined
    expect(Youch).toBeCalledTimes(1)
    expect(Youch).toBeCalledWith(
      errorFull,
      ctx.req,
      expect.any(Function),
      params.options.router.base,
      true
    )
    expect(ctx.res.statusCode).toEqual(404)
    expect(ctx.res.statusMessage).toEqual(error.name)
    expect(ctx.res.setHeader).toBeCalledTimes(3)
    expect(ctx.res.setHeader).nthCalledWith(1, 'Content-Type', 'text/json; charset=utf-8')
    expect(ctx.res.setHeader).nthCalledWith(2, 'Content-Length', Buffer.byteLength(errJson))
    expect(ctx.res.setHeader).nthCalledWith(3, 'Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
    expect(params.resources.errorTemplate).not.toBeCalled()
    expect(ctx.res.end).toBeCalledTimes(1)
    expect(ctx.res.end).toBeCalledWith(errJson, 'utf-8')
  })

  test('should search all possible paths when read source', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = { fileName: 'webpack:///test-error.js?desc=test' }
    const readSource = Youch.mock.calls[0][2]
    await readSource(frame)

    const fileName = 'test-error.js'
    expect(frame).toEqual({ fileName })
    expect(path.resolve).toBeCalledTimes(5)
    expect(fs.readFile).toBeCalledTimes(5)
    expect(fs.readFile).nthCalledWith(1, `resolve(${params.options.srcDir}, ${fileName})`, 'utf-8')
    expect(fs.readFile).nthCalledWith(2, `resolve(${params.options.rootDir}, ${fileName})`, 'utf-8')
    expect(fs.readFile).nthCalledWith(3, `resolve(join(${params.options.buildDir}, dist, server), ${fileName})`, 'utf-8')
    expect(fs.readFile).nthCalledWith(4, `resolve(${params.options.buildDir}, ${fileName})`, 'utf-8')
    expect(fs.readFile).nthCalledWith(5, `resolve(${process.cwd()}, ${fileName})`, 'utf-8')
  })

  test('should return source content after read source', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = { fileName: 'webpack:///test-error.js?desc=test' }
    const readSource = Youch.mock.calls[0][2]
    fs.readFile.mockImplementationOnce(() => Promise.resolve('source content'))
    await readSource(frame)

    const fileName = 'test-error.js'
    expect(frame).toEqual({
      fileName,
      contents: 'source content',
      fullPath: `resolve(${params.options.srcDir}, ${fileName})`
    })
  })

  test('should return relative fileName if fileName is absolute path', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = { fileName: 'webpack:///test-error.js?desc=test' }
    const readSource = Youch.mock.calls[0][2]
    fs.readFile.mockImplementationOnce(() => Promise.resolve('source content'))
    path.isAbsolute.mockReturnValueOnce(true)
    path.relative.mockImplementationOnce((...args) => `relative(${args.join(', ')})`)
    await readSource(frame)

    const fullPath = `resolve(${params.options.srcDir}, test-error.js)`
    expect(frame).toEqual({
      fileName: `relative(${params.options.rootDir}, ${fullPath})`,
      contents: 'source content',
      fullPath
    })
  })

  test('should ignore error when reading source', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = { fileName: 'webpack:///test-error.js?desc=test' }
    const readSource = Youch.mock.calls[0][2]
    fs.readFile.mockReturnValueOnce(Promise.reject(new Error('read failed')))
    await readSource(frame)

    const fileName = 'test-error.js'
    expect(frame).toEqual({ fileName })
    expect(path.resolve).toBeCalledTimes(5)
    expect(fs.readFile).toBeCalledTimes(5)
  })

  test('should return if fileName is unknown when read source', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = {}
    const readSource = Youch.mock.calls[0][2]
    await readSource(frame)

    expect(frame.fileName).toBeNull()
  })
})
