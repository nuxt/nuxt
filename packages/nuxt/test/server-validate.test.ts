import { describe, expect, expectTypeOf, it } from 'vitest'

import { getValidatedQuery, readValidatedBody } from '../src/server/index'
import type { RequestEvent } from '../src/server/index'

function event (request: Request): RequestEvent {
  return { req: request, url: new URL(request.url), res: { headers: new Headers() }, context: {} }
}

const post = (body: unknown) => event(new Request('https://nuxt.com/api', {
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
}))

const named = {
  '~standard': {
    version: 1 as const,
    vendor: 'test',
    types: undefined as { input: unknown, output: { name: string } } | undefined,
    validate: (value: unknown) => typeof (value as { name?: unknown })?.name === 'string'
      ? { value: { name: (value as { name: string }).name.toUpperCase() } }
      : { issues: [{ message: 'name is required', path: ['name'] }] },
  },
}

describe('`readValidatedBody`', () => {
  it('resolves the output of a Standard Schema', async () => {
    const body = await readValidatedBody(post({ name: 'nuxt' }), named)
    expectTypeOf(body).toEqualTypeOf<{ name: string }>()
    expect(body).toEqual({ name: 'NUXT' })
  })

  it('rejects input a Standard Schema fails with a 400 carrying the issues', async () => {
    await expect(readValidatedBody(post({}), named)).rejects.toMatchObject({
      status: 400,
      statusText: 'Validation failed',
      data: { message: 'Validation failed', issues: [{ message: 'name is required', path: ['name'] }] },
    })
  })

  it('rejects with the error `onError` describes', async () => {
    await expect(readValidatedBody(post({}), named, { onError: ({ issues }) => ({ status: 422, message: issues[0]!.message }) }))
      .rejects.toMatchObject({ status: 422, message: 'name is required' })
  })

  it.for<[string, () => unknown, unknown]>([
    ['the value it returns', () => ({ ok: 1 }), { ok: 1 }],
    ['the input for `true`', () => true, { name: 'nuxt' }],
    ['the input for nothing', () => {}, { name: 'nuxt' }],
  ])('resolves %s from a validator function', async ([, validate, expected]) => {
    await expect(readValidatedBody(post({ name: 'nuxt' }), validate)).resolves.toEqual(expected)
  })

  it('rejects input a validator function refuses', async () => {
    await expect(readValidatedBody(post({}), () => false)).rejects.toMatchObject({ status: 400, statusText: 'Validation failed' })
  })

  it('rejects with the message a validator function throws, keeping an HTTP error as it is', async () => {
    await expect(readValidatedBody(post({}), () => {
      throw new Error('bad name')
    })).rejects.toMatchObject({ status: 400, message: 'bad name', data: { message: 'Validation failed' } })
    await expect(readValidatedBody(post({}), () => {
      throw Object.assign(new Error('gone'), { name: 'HTTPError', status: 410 })
    })).rejects.toMatchObject({ status: 410, message: 'gone' })
  })
})

describe('`getValidatedQuery`', () => {
  it('validates the parsed query', async () => {
    const query = await getValidatedQuery(event(new Request('https://nuxt.com/api?name=nuxt')), named)
    expect(query).toEqual({ name: 'NUXT' })
    await expect(getValidatedQuery(event(new Request('https://nuxt.com/api')), named)).rejects.toMatchObject({ status: 400 })
  })

  it('types the input a validator function receives as the parsed query', async () => {
    const page = await getValidatedQuery(event(new Request('https://nuxt.com/api?page=2')), (query) => {
      expectTypeOf(query).toEqualTypeOf<Record<string, string | string[]>>()
      return Number(query.page)
    })
    expect(page).toBe(2)
  })
})
