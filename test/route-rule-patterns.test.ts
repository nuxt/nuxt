import { readdir } from 'node:fs/promises'
import { join } from 'pathe'
import { describe, expect, it } from 'vitest'
import { $fetch, fetch, useTestContext } from '@nuxt/test-utils/e2e'

import { isNitroV3, runsOnceInMatrix } from './matrix'
import { renderPage, setupFixture } from './utils'

await setupFixture('route-rule-patterns', runsOnceInMatrix, { browser: true })

function readRules (html: string): Record<string, any> {
  const json = /<pre id="rules">(.*?)<\/pre>/s.exec(html)![1]!
  return JSON.parse(json.replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
}

async function navigate (link: string) {
  const { page, pageErrors } = await renderPage('/')
  await page.click(`#${link}`)
  await page.waitForFunction(() => window.useNuxtApp?.()._route.fullPath !== '/')
  await page.locator('#page').waitFor()
  const path = await page.evaluate(() => window.useNuxtApp?.()._route.fullPath)
  const marker = await page.locator('#page').textContent()
  const rules = await page.locator('#rules').count() ? JSON.parse(await page.locator('#rules').textContent() || '{}') : undefined
  const middlewareRuns = await page.locator('#middleware').count() ? Number(await page.locator('#middleware').textContent()) : undefined
  expect(pageErrors).toEqual([])
  await page.close()
  return { path, marker: marker?.trim(), rules, middlewareRuns }
}

describe.skipIf(!runsOnceInMatrix)('route rules with a single `*` on a nested path', () => {
  it('resolves the same rules during SSR as the server applies', async () => {
    const rules = readRules(await $fetch<string>('/'))
    expect(rules['/spa/a/b'].ssr).toBe(isNitroV3 ? false : undefined)
    expect(rules['/redirect/a/b'].redirect).toBe(isNitroV3 ? '/target' : undefined)
    expect(rules['/middleware/a/b'].appMiddleware).toEqual(isNitroV3 ? { probe: true } : undefined)
    expect(rules['/module/a/b'].appMiddleware).toEqual(isNitroV3 ? { probe: true } : undefined)
    expect(rules['/cache/a/b'].payload).toBe(isNitroV3 ? true : undefined)
  })

  it('redirects a direct request and a client navigation alike', async () => {
    const response = await fetch('/redirect/a/b', { redirect: 'manual' })
    expect(response.status).toBe(isNitroV3 ? 307 : 200)
    expect(response.headers.get('location')).toBe(isNitroV3 ? '/target' : null)

    const { path, marker } = await navigate('redirect')
    expect(path).toBe(isNitroV3 ? '/target' : '/redirect/a/b')
    expect(marker).toBe(isNitroV3 ? 'target-page' : 'slug-page')
  })

  it.each(['middleware', 'module'])('runs `appMiddleware` from a `%s` rule during SSR and after client navigation', async (name) => {
    const html = await $fetch<string>(`/${name}/a/b`)
    expect(/<p id="middleware">\s*(\d+)\s*<\/p>/.exec(html)?.[1]).toBe(isNitroV3 ? '1' : '0')

    const { path, rules, middlewareRuns } = await navigate(name)
    expect(path).toBe(`/${name}/a/b`)
    expect(rules.appMiddleware).toEqual(isNitroV3 ? { probe: true } : undefined)
    expect(middlewareRuns).toBe(isNitroV3 ? 1 : 0)
  })

  it('serves an SPA shell where the app resolves `ssr: false`', async () => {
    const html = await $fetch<string>('/spa/a/b')
    expect(html.includes('slug-page')).toBe(!isNitroV3)

    const { rules } = await navigate('spa')
    expect(rules.ssr).toBe(isNitroV3 ? false : undefined)
  })

  it('caches a response where the app resolves a payload', async () => {
    const response = await fetch('/cache/a/b')
    expect(!!response.headers.get('cache-control')).toBe(isNitroV3)

    const { rules } = await navigate('cache')
    expect(rules.payload).toBe(isNitroV3 ? true : undefined)
  })

  it('prerenders a page that a `prerender` rule covers', async () => {
    // @ts-expect-error untyped private property
    const publicDir: string = useTestContext().nuxt._nitro.options.output.publicDir
    const files = await readdir(join(publicDir, 'prerendered/a/b')).catch(() => [] as string[])
    expect(files.includes('index.html')).toBe(isNitroV3)
  })
})
