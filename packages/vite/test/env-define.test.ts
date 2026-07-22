import { describe, expect, it } from 'vitest'
import type { Nuxt } from 'nuxt/schema'

import { getClientEnvDefine, getSsrEnvDefine } from '../src/shared/env-define.ts'

function createNuxt (compatibilityVersion: 4 | 5): Nuxt {
  return {
    options: {
      future: { compatibilityVersion },
      dev: false,
      test: false,
      envName: 'production',
      vite: { mode: 'production' },
      experimental: { clientNodeCompat: false },
    },
  } as Nuxt
}

describe('build env defines', () => {
  it('includes legacy process flags for compatibilityVersion 4 client', () => {
    const define = getClientEnvDefine(createNuxt(4))
    expect(define).toMatchObject({
      'process.server': false,
      'process.client': true,
      'process.browser': true,
      'import.meta.client': true,
    })
  })

  it('omits deprecated process flags for compatibilityVersion 5 client', () => {
    const define = getClientEnvDefine(createNuxt(5))
    expect(define).not.toHaveProperty('process.server')
    expect(define).not.toHaveProperty('process.client')
    expect(define).not.toHaveProperty('process.browser')
    expect(define).toMatchObject({
      'import.meta.client': true,
      'process.prerender': false,
      'process.nitro': false,
    })
  })

  it('includes legacy process flags for compatibilityVersion 4 server', () => {
    const define = getSsrEnvDefine(createNuxt(4))
    expect(define).toMatchObject({
      'process.server': true,
      'process.client': false,
      'process.browser': false,
      'import.meta.server': true,
    })
  })

  it('omits deprecated process flags for compatibilityVersion 5 server', () => {
    const define = getSsrEnvDefine(createNuxt(5))
    expect(define).not.toHaveProperty('process.server')
    expect(define).not.toHaveProperty('process.client')
    expect(define).not.toHaveProperty('process.browser')
    expect(define).toMatchObject({
      'import.meta.server': true,
      'import.meta.client': false,
    })
  })
})
