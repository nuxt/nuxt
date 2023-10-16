import type { Browser, BrowserContextOptions } from 'playwright-core'
import { useTestContext } from './context'
import { url } from './server'

export async function createBrowser () {
  const ctx = useTestContext()

  let playwright: typeof import('playwright-core')
  try {
    // Workaround for https://github.com/nuxt/nuxt/issues/13441
    // TODO: Remove when upstream issue resolved
    playwright = await import(String('playwright-core'))
  } catch {
    /* istanbul ignore next */
    throw new Error(`
      The dependency 'playwright-core' not found.
      Please run 'yarn add --dev playwright-core' or 'npm install --save-dev playwright-core'
    `)
  }

  const { type, launch } = ctx.options.browserOptions
  if (!playwright[type]) {
    throw new Error(`Invalid browser '${type}'`)
  }

  ctx.browser = await playwright[type].launch(launch)
}

export async function getBrowser (): Promise<Browser> {
  const ctx = useTestContext()
  if (!ctx.browser) {
    await createBrowser()
  }
  return ctx.browser!
}

export async function createPage (path?: string, options?: BrowserContextOptions) {
  const browser = await getBrowser()
  const page = await browser.newPage(options)

  if (path) {
    await page.goto(url(path))
  }

  return page
}
