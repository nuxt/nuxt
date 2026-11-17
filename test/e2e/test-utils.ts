import { fileURLToPath } from 'node:url'
import { waitForHydration } from '@nuxt/test-utils/e2e'
import { test as base, expect as baseExpect } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { fetch } from 'ofetch'
import { joinURL } from 'ufo'

export interface MatrixOptions {
  isDev: boolean
  builder: 'vite' | 'rsbuild' | 'rspack' | 'webpack'
}

export function fixtureDir (name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url))
}

export interface ConsoleLog {
  type: string
  text: string
}

/** Console messages `page` logs from now on. */
export function collectConsoleLogs (page: Page): ConsoleLog[] {
  const logs: ConsoleLog[] = []
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }))
  return logs
}

const pageConsoleLogs = new WeakMap<Page, ConsoleLog[]>()

/** Console messages the test's `page` has logged so far. */
export function consoleLogs (page: Page): ConsoleLog[] {
  return pageConsoleLogs.get(page) ?? []
}

const test = base.extend<{ fetch: (path: string) => Promise<Response> } & MatrixOptions>({
  isDev: [false, { option: true }],
  builder: ['vite' as const, { option: true }],
  fetch: async ({ _nuxtHooks }, use) => {
    await use(async (path) => {
      while (true) {
        const res = await fetch(joinURL(_nuxtHooks.ctx.url!, path), {
          headers: { accept: 'text/html' },
          signal: AbortSignal.timeout(1000),
        }).catch(() => undefined)
        if (res && res.status !== 503 && res.status !== 500) {
          return res
        }
      }
    })
  },
})

test.use({
  page: async ({ page }, use) => {
    pageConsoleLogs.set(page, collectConsoleLogs(page))
    await use(page)
  },
  goto: async ({ page }, use) => {
    await use(async (path, options) => {
      const result = await page.goto(path, options as any)
      await waitForHydration(page, path, 'hydration')
      const overlay = await getViteErrorOverlay(page)
      if (overlay) {
        throw new Error(`Vite error overlay shown after navigating to ${path}:\n${overlay}`)
      }
      return result
    })
  },
})

// The overlay renders into a shadow root, so its text is invisible to normal locators and
// would otherwise only show up as "intercepts pointer events" in a click timeout.
function getViteErrorOverlay (page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('vite-error-overlay')?.shadowRoot
    if (!root) { return null }
    return ['.message-body', '.file', '.frame', '.stack']
      .map(selector => root.querySelector(selector)?.textContent?.trim())
      .filter(Boolean)
      .join('\n')
  })
}

const expect = baseExpect.extend({
  toHaveNoErrorsOrWarnings (page: Page) {
    const errorLogs = consoleLogs(page).filter(log =>
      log.type === 'error' || (log.type === 'warning' && !log.text.includes('webpack/hot/dev-server') && !log.text.includes('Extraneous non-props attributes (style) were passed to component')))

    const pass = errorLogs.length === 0
    const message = pass ? '' : `Found error logs: ${errorLogs.map(log => log.text).join('\n')}`

    return {
      message: () => message,
      pass,
      name: 'toHaveNoErrorsOrWarnings',
      expected: [],
      actual: errorLogs,
    }
  },
})

export { test, expect }
