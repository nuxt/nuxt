import { describe, expect, it } from 'vitest'
import { applyDefaults } from 'untyped'

import { NuxtConfigSchema } from '../src/index.ts'
import type { NuxtOptions } from '../src/index.ts'

describe('vite.define defaults', () => {
  it('includes deprecated process flags when compatibilityVersion is 4', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 4 } })
    const define = (result as unknown as NuxtOptions).vite.define
    expect(define).toHaveProperty('process.dev')
    expect(define).toHaveProperty('process.test')
    expect(define).toHaveProperty('import.meta.dev')
    expect(define).toHaveProperty('import.meta.test')
  })

  it('omits deprecated process flags when compatibilityVersion is 5', async () => {
    const result = await applyDefaults(NuxtConfigSchema, { future: { compatibilityVersion: 5 } })
    const define = (result as unknown as NuxtOptions).vite.define
    expect(define).not.toHaveProperty('process.dev')
    expect(define).not.toHaveProperty('process.test')
    expect(define).toHaveProperty('import.meta.dev')
    expect(define).toHaveProperty('import.meta.test')
  })

  it('preserves user overrides for vite.define', async () => {
    const result = await applyDefaults(NuxtConfigSchema, {
      future: { compatibilityVersion: 5 },
      vite: { define: { 'process.dev': true } },
    })
    expect((result as unknown as NuxtOptions).vite.define).toMatchObject({
      'process.dev': true,
    })
  })
})
