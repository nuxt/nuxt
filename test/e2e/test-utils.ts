import { createTest, waitForHydration } from '@nuxt/test-utils/e2e'
import { test as base, expect as baseExpect } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import defu from 'defu'
import { fetch } from 'ofetch'
import { isWindows } from 'std-env'
import { joinURL } from 'ufo'

export interface MatrixOptions {
  isDev: boolean
  isBuilt: boolean
  isWebpack: boolean
  builder: 'vite' | 'rspack' | 'webpack'
}

// TODO: remove custom _nuxtHooks below when upgrading nuxt/test-utils
const FIXTURE_TIMEOUT = (isWindows ? 420 : 180) * 1000
const DEFAULT_SETUP_TIMEOUT = (isWindows ? 360 : 120) * 1000

const test = base.extend<{ fetch: (path: string) => Promise<Response> } & MatrixOptions>({
  isDev: [false, { option: true }],
  isBuilt: [true, { option: true }],
  isWebpack: [false, { option: true }],
  builder: ['vite' as const, { option: true }],
  _nuxtHooks: [async ({ nuxt, defaults }, use) => {
    const hooks = createTest(defu(nuxt || {}, defaults.nuxt || {}))
    const setupTimeout = hooks.ctx.options.setupTimeout || DEFAULT_SETUP_TIMEOUT

    const setup = hooks.beforeAll()

    try {
      let timer: NodeJS.Timeout | undefined
      await Promise.race([
        setup,
        new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`Nuxt fixture setup did not complete within ${setupTimeout}ms`)), setupTimeout)
        }),
      ]).finally(() => clearTimeout(timer))
    } catch (error) {
      await hooks.afterAll().catch(() => {})
      // a timed-out setup may still spawn a dev server after teardown has run
      await Promise.race([setup.catch(() => {}), new Promise(resolve => setTimeout(resolve, 30_000))])
      await hooks.afterAll().catch(() => {})
      const logs = hooks.ctx.serverLogs?.join('\n')
      throw new Error(`Nuxt fixture setup failed for ${hooks.ctx.options.rootDir}: ${error instanceof Error ? error.message : error}${logs ? `\n\nServer output:\n${logs}` : ''}`, { cause: error })
    }

    await use(hooks)

    await hooks.afterAll()
  }, { scope: 'worker', timeout: FIXTURE_TIMEOUT }],
  fetch: ({ request, _nuxtHooks }, use) => {
    use(async (path) => {
      let res: Response | undefined
      do {
        res = await fetch(joinURL(_nuxtHooks.ctx.url!, path), {
          headers: { 'accept': 'text/html' },
          signal: AbortSignal.timeout(1000),
        }).catch(() => undefined)
      } while (!res || res?.status === 503 || res?.status === 500)

      if (!res) {
        await request.get(path, { headers: { 'accept': 'text/html' } })
      }

      return res
    })
  },
})

test.use({
  page: ({ page }, use) => {
    const consoleLogs: Array<{ type: string, text: string }> = []
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
      })
    })
    // @ts-expect-error untyped
    page._consoleLogs = consoleLogs
    return use(page)
  },
  goto: ({ page }, use) => {
    use(async (path, options) => {
      const result = await page.goto(path, options as any)
      await waitForHydration(page, path, 'hydration')
      return result
    })
  },
})

const expect = baseExpect.extend({
  // Utility function to wait for a condition to be true
  async toBeWithPolling <T = true> (
    getter: () => Promise<T> | T,
    expected: T | ((val: T) => boolean) = true as T,
    options: { timeout?: number, interval?: number, message?: string } = {},
  ) {
    const { timeout = 8000, interval = 300 } = options
    const startTime = Date.now()
    let lastValue: T | undefined
    let lastError: Error | undefined

    // Create a matcher function
    const matcher = typeof expected === 'function'
      ? expected as ((val: T) => boolean)
      : (val: T) => val === expected

    let pass = false

    while (Date.now() - startTime < timeout) {
      try {
        lastValue = await getter()
        if (matcher(lastValue)) {
          pass = true
          break
        }
      } catch (err) {
        lastError = err as Error
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, interval))
    }

    const message = options.message || `Timed out after ${timeout}ms waiting for condition to be met.`

    // if (lastError) {
    //   throw new Error(`${errorMessage}\nLast error: ${lastError.message}`)
    // }

    // throw new Error(`${errorMessage}\nExpected: ${expected}\nReceived: ${lastValue!}`)
    return {
      message: () => pass ? '' : lastError ? `${message}\nLast error: ${lastError.message}` : `${message}\nExpected: ${expected}\nReceived: ${lastValue!}`,
      pass,
      name: 'toBeWithPolling',
      expected,
      actual: lastValue,
    }
  },
  toHaveNoErrorsOrWarnings (page: Page) {
    // @ts-expect-error untyped
    const consoleLogs: Array<{ text: string, type: string }> = page._consoleLogs
    const errorLogs = consoleLogs.filter(log =>
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
