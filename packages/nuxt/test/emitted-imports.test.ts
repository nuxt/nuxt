import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { compileRoutes } from 'fetchdts/compiler'
import { describe, expect, it } from 'vitest'

/**
 * The module Nuxt emits for server routes imports its type vocabulary from `nuxt/app`, because
 * `fetchdts` is not a dependency of user projects.
 */
describe('the emitted route module', () => {
  const appIndex = readFileSync(join(import.meta.dirname, '../src/app/index.ts'), 'utf-8')

  /** A route set that makes the compiler emit every accessor it has. */
  const compiled = compileRoutes([{
    routes: [
      {
        segments: [{ type: 'static', value: '/api' }, { type: 'static', value: '/thing' }],
        metadata: {
          GET: { responseType: 'string', responseHeadersType: `{ 'x-a': string }`, errorResponseType: '{ message: string }' },
          POST: { responseType: 'string', bodyType: '{ a: 1 }', queryType: '{ b: 1 }', headersType: `{ 'x-c': string }` },
        },
      },
      { segments: [{ type: 'static', value: '/api' }, { type: 'dynamic' }], metadata: { GET: { responseType: 'number' } } },
      { segments: [{ type: 'static', value: '/files' }, { type: 'wildcard' }], metadata: { ALL: { responseType: 'string' } } },
    ],
  }], { name: 'GeneratedServerRoutes', moduleSpecifier: 'nuxt/app', resolveAgainst: 'ServerRoutes' })

  /** The names the emitted module imports from `nuxt/app`. */
  const imported = [...compiled.code.matchAll(/^import type \{([^}]*)\} from 'nuxt\/app'$/gm)]
    .flatMap(match => match[1]!.split(',').map(name => name.trim()))
    .filter(Boolean)

  it('imports something, so the assertion below is not vacuous', () => {
    expect(imported.length).toBeGreaterThan(8)
  })

  it.each(imported)('has %s re-exported from nuxt/app', (name) => {
    expect(appIndex).toMatch(new RegExp(`\\b${name}\\b`))
  })
})
