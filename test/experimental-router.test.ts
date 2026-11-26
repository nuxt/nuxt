import { describe, expect, it } from 'vitest'
import { $fetch, fetch } from '@nuxt/test-utils/e2e'

import { runsOncePerEnvInMatrix } from './matrix'
import { renderPage, setupFixture } from './utils'

const shouldRun = runsOncePerEnvInMatrix

await setupFixture('experimental-router', shouldRun, { browser: true })

describe.skipIf(!shouldRun)('experimental.experimentalRouter', () => {
  it('renders pages, params and links on the server', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('experimental-router-index')
    expect(html).toContain('href="/users/42"')
    expect(html).toContain('href="/users/a%20b?tab=info"')
    expect(html).toContain('href="/parent"')

    const user = await $fetch<string>('/users/a%20b?tab=info')
    expect(user).toContain('experimental-router-user-a b')
    expect(user).toContain('tracked-by-middleware')
  })

  it('accepts a trailing slash', async () => {
    expect(await $fetch<string>('/users/42/')).toContain('experimental-router-user-42')
  })

  it('parses every query value into an array', async () => {
    const html = await $fetch<string>('/users/1?tab=info')
    expect(html).toMatch(/<p id="query">\s*\[\s*&quot;info&quot;\s*\]\s*<\/p>/)
  })

  it('renders nested and catch-all pages', async () => {
    const parent = await $fetch<string>('/parent')
    expect(parent).toContain('parent-layout')
    expect(parent).toContain('parent-index')
    expect(await $fetch<string>('/parent/child')).toContain('parent-child')
    expect(await $fetch<string>('/a/b/c')).toContain('catch-all:a|b|c')
  })

  it('redirects from `definePageMeta`', async () => {
    const response = await fetch('/old', { redirect: 'manual' })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/parent/child')
  })

  it('refuses to change the route table at runtime', async () => {
    const html = await $fetch<string>('/add-route')
    expect(html).toMatch(/e2014|staticRoutes/i)
    expect(html).not.toContain('>added<')
  })

  it('keeps in-component guards off the shared route records', async () => {
    for (let i = 0; i < 3; i++) {
      expect(await $fetch<string>('/guards')).toContain('shared-record-guards:0')
    }
  })

  it('navigates on the client', async () => {
    const { page, pageErrors } = await renderPage('/')

    await page.click('#user')
    await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('user-42'))
    expect(await page.textContent('#middleware')).toContain('tracked-by-middleware')

    await page.goBack()
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'experimental-router-index')

    await page.click('#named')
    await page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('user-a b'))
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/users/a%20b?tab=info')
    expect(await page.textContent('#query')).toContain('info')

    await page.goBack()
    await page.click('#router-link')
    await page.waitForFunction(() => document.body.textContent?.includes('parent-index'))

    expect(pageErrors).toEqual([])
    await page.close()
  })
})
