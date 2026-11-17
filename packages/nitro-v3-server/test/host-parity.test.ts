import { describe, expect, it } from 'vitest'

import * as nuxt4 from '../src/runtime/host/nuxt4.ts'
import * as nuxt5 from '../src/runtime/host/nuxt5.ts'

describe('renderer hosts', () => {
  it('provide the same names', () => {
    expect(Object.keys(nuxt4).sort()).toEqual(Object.keys(nuxt5).sort())
  })
})
