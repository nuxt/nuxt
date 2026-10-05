import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { $fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOnceInMatrix } from './matrix'

const shouldRun = runsOnceInMatrix

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/no-pages-links', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  })
}

const LINKS = ['custom', 'default', 'blank'] as const

async function hrefs (to: string) {
  const html = await $fetch<string>('/', { query: { to } })
  const rendered: Record<string, string | null> = {}
  for (const [anchor] of html.matchAll(/<a [^>]*>/g)) {
    const link = anchor.match(/data-link="([^"]*)"/)?.[1]
    if (link) {
      rendered[link] = anchor.match(/href="([^"]*)"/)?.[1] ?? null
    }
  }
  expect(Object.keys(rendered).sort()).toEqual([...LINKS].sort())
  return rendered
}

describe.skipIf(!shouldRun)('links rendered without pages', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '\u0001javascript:alert(1)',
    '\u0000javascript:alert(1)',
    '\tjavascript:alert(1)',
    'java\tscript:alert(1)',
    '\u0001data:text/html,<script>alert(1)</script>',
    '\u0001vbscript:alert(1)',
    'view-source:javascript:alert(1)',
    '\u0001view-source:\u0001javascript:alert(1)',
  ])('renders no href for %j', async (to) => {
    for (const [link, href] of Object.entries(await hrefs(to))) {
      expect(href, link).toBe(null)
    }
  })

  it.each([
    ['/safe', '/safe'],
    ['/safe?a=1#b', '/safe?a=1#b'],
    ['#hash', '#hash'],
    ['https://example.com/a', 'https://example.com/a'],
    ['mailto:someone@example.com', 'mailto:someone@example.com'],
  ])('renders %j as %j', async (to, expected) => {
    for (const [link, href] of Object.entries(await hrefs(to))) {
      expect(href, link).toBe(expected)
    }
  })
})
