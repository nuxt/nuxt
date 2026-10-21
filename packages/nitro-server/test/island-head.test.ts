import { describe, expect, it } from 'vitest'
import type { SerializableHead } from '@unhead/vue/types'

import { toSafeHeadInput } from '../src/runtime/utils/island-head'

describe('toSafeHeadInput', () => {
  it('should drop input that useHeadSafe does not allow', () => {
    const safe = toSafeHeadInput({
      htmlAttrs: { lang: 'en', onclick: 'run()' },
      bodyAttrs: { class: 'page', onload: 'run()' },
      base: { href: 'https://example.com/' },
      link: [
        { rel: 'stylesheet', href: 'javascript:run()' },
        { rel: 'preload', href: '/asset.js' },
      ],
      script: [{ textContent: 'run()' }, { src: 'https://example.com/run.js' }],
      style: [{ textContent: 'body { color: red }' }],
      noscript: [{ textContent: '<img src="x" onerror="run()">' }],
    } as SerializableHead)

    expect(safe).toEqual({
      htmlAttrs: { lang: 'en' },
      bodyAttrs: { class: 'page' },
    })
  })

  it('should keep input that useHeadSafe allows', () => {
    const safe = toSafeHeadInput({
      title: 'Title <b>',
      titleTemplate: '%s - Site',
      htmlAttrs: { class: 'a b', dir: 'ltr' },
      bodyAttrs: { 'style': 'color:red;margin:0', 'data-theme': 'dark' },
      meta: [{ name: 'description', content: 'Description' }],
      link: [{ rel: 'icon', href: '/favicon.ico', tagPriority: 'high' }],
      script: [{ type: 'application/ld+json', textContent: { '@type': 'Person', 'name': '</script>' } }],
    } as SerializableHead)

    expect(safe).toEqual({
      title: 'Title <b>',
      titleTemplate: '%s - Site',
      htmlAttrs: { class: 'a b', dir: 'ltr' },
      bodyAttrs: { 'style': 'color:red;margin:0', 'data-theme': 'dark' },
      meta: [{ name: 'description', content: 'Description' }],
      link: [{ rel: 'icon', href: '/favicon.ico', tagPriority: 'high' }],
      script: [{ type: 'application/ld+json', textContent: '{"@type":"Person","name":"\\u003C/script>"}' }],
    })
  })
})
