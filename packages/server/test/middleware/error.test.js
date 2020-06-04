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

const errorFileName = 'test-error.js'
const createError = () => {
  const err = new Error('Error!')
  err.stack = `Error!\n  at foo (webpack:///${errorFileName}?foo:1)`
  return err
}

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
    const error = {}
    error.headers = { 'Custom-Header': 'test' }
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    expect(ctx.res.statusCode).toEqual(500)
    expect(ctx.res.statusMessage).toEqual('RuntimeError')
    expect(ctx.res.setHeader).toBeCalledTimes(4)
    expect(ctx.res.setHeader).nthCalledWith(1, 'Content-Type', 'text/html; charset=utf-8')
    expect(ctx.res.setHeader).nthCalledWith(2, 'Content-Length', Buffer.byteLength('error template'))
    expect(ctx.res.setHeader).nthCalledWith(3, 'Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
    expect(ctx.res.setHeader).nthCalledWith(4, 'Custom-Header', 'test')
    expect(params.resources.errorTemplate).toBeCalledTimes(1)
    expect(params.resources.errorTemplate).toBeCalledWith({ status: 500 })
    expect(ctx.res.end).toBeCalledTimes(1)
    expect(ctx.res.end).toBeCalledWith('error template', 'utf-8')
  })

  test('should send json error response', async () => {
    const params = createParams()
    const errorMiddleware = createErrorMiddleware(params)
    const error = {
      statusCode: 404,
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
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const errHtml = 'youch html'

    expect(ctx.res.statusCode).toEqual(503)
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
      message: 'test error'
    }
    const ctx = createServerContext()
    ctx.req.headers.accept = 'application/json'

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const errJson = JSON.stringify('youch json', undefined, 2)

    expect(ctx.res.statusCode).toEqual(404)
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
    const error = createError()
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    expect(fs.existsSync).nthCalledWith(1, `resolve(${params.options.srcDir}, ${errorFileName})`)
    expect(fs.existsSync).nthCalledWith(2, `resolve(${params.options.rootDir}, ${errorFileName})`)
    expect(fs.existsSync).nthCalledWith(3, `resolve(join(${params.options.buildDir}, dist, server), ${errorFileName})`)
    expect(fs.existsSync).nthCalledWith(4, `resolve(${params.options.buildDir}, ${errorFileName})`)
    expect(fs.existsSync).nthCalledWith(5, `resolve(${process.cwd()}, ${errorFileName})`)
  })

  test('should return source content after read source', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = { fileName: errorFileName }
    const readSource = Youch.mock.calls[0][2]
    fs.existsSync.mockImplementationOnce(() => true)
    fs.readFile.mockImplementationOnce(() => Promise.resolve('source content'))
    await readSource(frame)

    expect(frame).toEqual({
      fileName: errorFileName,
      contents: 'source content',
      fullPath: errorFileName
    })
  })

  test('should ignore if source file not exists', async () => {
    const params = createParams()
    params.options.debug = true
    const errorMiddleware = createErrorMiddleware(params)
    const error = {}
    const ctx = createServerContext()

    await errorMiddleware(error, ctx.req, ctx.res, ctx.next)

    const frame = { fileName: errorFileName }
    const readSource = Youch.mock.calls[0][2]
    fs.exists.mockReturnValueOnce(false)
    await readSource(frame)
    expect(frame).toEqual({ fileName: errorFileName })
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

    expect(frame.fileName).toBeUndefined()
  })
})
