import { describe, expect, it } from 'vitest'
import { HTTPError } from 'h3'
import { NUXT_ERROR_SIGNATURE, NuxtError, createError, isNuxtError } from '#app/composables/error'
import { reducers } from '#app/plugins/revive-payload.server'
import { decodeSSRError, encodeSSRError, NUXT_ERROR_SIGNATURE as nitroSignature, stringifyErrorData } from '../../packages/nitro-server/src/runtime/utils/error'

const reduceNuxtError = reducers.find(([name]) => name === 'NuxtError')![1]

describe('NuxtError / h3 interop', () => {
  it('should be recognised by h3 as an HTTPError', () => {
    const error = createError({ status: 404, statusText: 'Not Found' })
    expect(HTTPError.isError(error)).toBe(true)
    expect(error.name).toBe('HTTPError')
  })

  it('should expose the same fields as h3 for equivalent input', () => {
    const inputs = [
      { status: 404, statusText: 'Not Found', message: 'nope', data: { a: 1 } },
      { statusCode: 418, statusMessage: 'Teapot' },
      { status: 999 },
      { message: 'plain' },
      { status: 500, unhandled: true, data: { secret: true } },
      { status: 400, body: { extra: 'field' } },
      { statusText: 'bad\nvalue' },
      { cause: { status: 403, statusText: 'Forbidden', message: 'from cause' } },
    ] as const

    for (const input of inputs) {
      /* eslint-disable @typescript-eslint/no-deprecated */
      const nuxtError = createError(input)
      const h3Error = new HTTPError(input)
      expect({
        status: nuxtError.status,
        statusText: nuxtError.statusText,
        statusCode: nuxtError.statusCode,
        statusMessage: nuxtError.statusMessage,
        message: nuxtError.message,
        data: nuxtError.data,
        body: nuxtError.body,
        unhandled: nuxtError.unhandled,
        json: nuxtError.toJSON(),
      }).toEqual({
        status: h3Error.status,
        statusText: h3Error.statusText,
        statusCode: h3Error.statusCode,
        statusMessage: h3Error.statusMessage,
        message: h3Error.message,
        data: h3Error.data,
        body: h3Error.body,
        unhandled: h3Error.unhandled,
        json: h3Error.toJSON(),
      })
      /* eslint-enable @typescript-eslint/no-deprecated */
    }
  })

  it('should default to a 500 status', () => {
    expect(createError('boom').status).toBe(500)
  })

  it('should fall back to a 500 status where h3 yields NaN', () => {
    expect(new HTTPError({ statusCode: 'abc' as unknown as number }).status).toBeNaN()
    expect(createError({ statusCode: 'abc' as unknown as number }).status).toBe(500)
  })

  it('should normalise headers', () => {
    const error = createError({ status: 400, headers: { 'x-test': '1' } })
    expect(error.headers).toBeInstanceOf(Headers)
    expect(error.headers!.get('x-test')).toBe('1')
    expect(createError('boom').headers).toBeUndefined()
  })

  it('should set fatal from unhandled unless given explicitly', () => {
    expect(createError({ status: 500, unhandled: true }).fatal).toBe(true)
    expect(createError({ status: 500 }).fatal).toBe(false)
    expect(createError({ status: 500, fatal: true }).fatal).toBe(true)
    expect(createError({ status: 500, unhandled: true, fatal: false }).fatal).toBe(false)
  })

  it('should keep the original error as `cause`', () => {
    const cause = new Error('original')
    const error = createError(cause)
    expect(error.cause).toBe(cause)
    expect(error.message).toBe('original')
  })

  it('should return existing nuxt errors unchanged', () => {
    const error = createError({ status: 404 })
    expect(createError(error)).toBe(error)
  })

  it('should not identify h3 errors as nuxt errors', () => {
    expect(isNuxtError(new HTTPError({ status: 404 }))).toBe(false)
    expect(isNuxtError(createError({ status: 404 }))).toBe(true)
  })

  // `toJSON` is what Nitro's default handler turns into the HTTP error body, so
  // anything added here ends up in the JSON every Nuxt app returns to API
  // clients. Nuxt-only state belongs in the payload reducer instead.
  it('should keep `toJSON` free of nuxt internals', () => {
    const error = createError({ status: 404, statusText: 'Not Found', fatal: true })
    expect(Object.keys(error.toJSON())).toEqual(['status', 'statusText', 'unhandled', 'message', 'data'])
  })

  it('should survive a payload round trip', () => {
    const error = createError({ status: 404, statusText: 'Not Found', message: 'missing', data: { id: 1 } })
    const revived = createError(JSON.parse(JSON.stringify(reduceNuxtError(error))))
    expect(revived.status).toBe(404)
    expect(revived.statusText).toBe('Not Found')
    expect(revived.message).toBe('missing')
    expect(revived.data).toEqual({ id: 1 })
    expect(revived.fatal).toBe(false)
    expect(isNuxtError(revived)).toBe(true)
  })

  it('should preserve `fatal` across a payload round trip', () => {
    const error = createError({ status: 404, message: 'missing', fatal: true })
    const revived = createError(JSON.parse(JSON.stringify(reduceNuxtError(error))))
    expect(revived.fatal).toBe(true)
    expect(revived.unhandled).toBeUndefined()
  })

  it('should hide details of unhandled errors across a payload round trip', () => {
    const error = createError({ status: 500, message: 'secret', data: { secret: true }, unhandled: true })
    const revived = createError(JSON.parse(JSON.stringify(reduceNuxtError(error))))
    expect(revived.message).toBe('HTTPError')
    expect(revived.data).toBeUndefined()
    expect(revived.unhandled).toBe(true)
    expect(revived.fatal).toBe(true)
  })

  it('should be constructible directly with either signature', () => {
    expect(new NuxtError('boom', { status: 400 }).status).toBe(400)
    expect(new NuxtError({ status: 400, message: 'boom' }).message).toBe('boom')
  })
})

describe('error signature', () => {
  it('should match the copy the nitro error handler sends', () => {
    expect(nitroSignature).toBe(NUXT_ERROR_SIGNATURE)
  })
})

describe('ssr error encoding', () => {
  it('should drop unserialisable data rather than throw', () => {
    const data: Record<string, unknown> = { name: 'node' }
    data.self = data

    const encoded = encodeSSRError({ status: 500, message: 'boom', url: '/', data } as any)
    expect(JSON.parse(encoded)).toMatchObject({ status: 500, message: 'boom' })
    expect(JSON.parse(encoded).data).toBeUndefined()
  })

  it('should fall back to an empty object when nothing serialises', () => {
    const error = { status: 500, url: '/', get message (): string { throw new Error('boom') } }
    expect(encodeSSRError(error as any)).toBe('{}')
  })
})

describe('experimental.parseErrorData compatibility', () => {
  it('should stringify structured `data` and leave everything else alone', () => {
    expect(stringifyErrorData({ reason: 'missing' })).toBe('{"reason":"missing"}')
    expect(stringifyErrorData([1, 2])).toBe('[1,2]')
    expect(stringifyErrorData('plain')).toBe('plain')
    expect(stringifyErrorData(undefined)).toBeUndefined()
  })

  it('should not touch `data` when decoding', () => {
    const encoded = JSON.stringify({ status: 500, data: { reason: 'missing' } })

    expect(decodeSSRError(encoded)!.data).toEqual({ reason: 'missing' })
  })
})
