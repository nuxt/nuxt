import { describe, expect, it } from 'vitest'

import { extractRouteRules, globRouteRulesFromPages, removePagesMetaRouteRules } from '../src/pages/route-rules'

describe('route-rules', () => {
  it('should extract route rules from pages', () => {
    for (const [path, code] of Object.entries(examples)) {
      const result = extractRouteRules(code, path)

      expect(result).toStrictEqual({
        'prerender': true,
      })
    }
  })
})

const examples = {
  // vue component with two script blocks
  'app.vue': `
<template>
  <div></div>
</template>

<script>
export default {}
</script>

<script setup lang="ts">
defineRouteRules({
  prerender: true
})
</script>
      `,
  // vue component with a normal script block, and defineRouteRules ambiently
  'component.vue': `
<script>
defineRouteRules({
  prerender: true
})
export default {
  setup() {}
}
</script>
      `,
  // JS component with defineRouteRules within a setup function
  'component.ts': `
export default {
  setup() {
    defineRouteRules({
      prerender: true
    })
  }
}
    `,
}

describe('routeRules from page meta', () => {
  const pages = [
    {
      path: '/',
      meta: { routeRules: { prerender: true } },
    },
    // page with routeRules and other meta
    {
      path: '/about',
      meta: { foo: 'foo', routeRules: { prerender: true } },
    },
    // parent without routeRules
    {
      path: '/users',
      meta: {},
      children: [{ path: ':id', meta: { routeRules: { prerender: true } } }],
    },
    // page with empty routeRules
    {
      path: '/contact',
      meta: { routeRules: {} },
    },
  ]

  it('extracts route rules from pages meta', () => {
    const result = globRouteRulesFromPages(pages)
    expect(result).toEqual({
      '/': { prerender: true },
      '/about': { prerender: true },
      '/users/**': { prerender: true },
    })
  })

  it('removes route rules from pages meta', () => {
    removePagesMetaRouteRules(pages)
    expect(pages).toEqual([
      { path: '/' },
      { path: '/about', meta: { foo: 'foo' } },
      { path: '/users', children: [{ path: ':id' }] },
      { path: '/contact' },
    ])
  })
})
