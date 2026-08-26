import { describe, expect, it } from 'vitest'

import { isInlineStyleId, withInlineQuery } from './inline-styles.ts'

describe('withInlineQuery', () => {
  it('appends the query when there is no trailing lang marker', () => {
    expect(withInlineQuery('/app/assets/global.css')).toBe('/app/assets/global.css?inline&used')
    expect(withInlineQuery('/app/assets/global.css?direct')).toBe('/app/assets/global.css?direct&inline&used')
  })

  it('inserts the query before a trailing lang marker', () => {
    expect(withInlineQuery('/app/app.vue?vue&type=style&index=0&scoped=7d7f4a5d&lang.css'))
      .toBe('/app/app.vue?vue&type=style&index=0&scoped=7d7f4a5d&inline&used&lang.css')
  })
})

describe('isInlineStyleId', () => {
  it.each([
    '/app/assets/global.css?inline&used',
    '/app/assets/global.css?direct&inline&used',
    '/app/app.vue?vue&type=style&index=0&inline&used&lang.css',
  ])('matches %s', (id) => {
    expect(isInlineStyleId(id)).toBe(true)
  })

  it.each([
    null,
    undefined,
    '/app/assets/global.css',
    '/app/app.vue?vue&type=style&index=0&lang.css',
    '/app/assets/global.css?inline&usedx',
  ])('does not match %s', (id) => {
    expect(isInlineStyleId(id)).toBe(false)
  })
})
