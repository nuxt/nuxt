import { expect } from 'vitest'
import type { Page } from 'playwright'
import { createPage, getBrowser, url, useTestContext } from '@nuxt/test-utils'

export async function renderPage (path = '/') {
  const ctx = useTestContext()
  if (!ctx.options.browser) {
    throw new Error('`renderPage` require `options.browser` to be set')
  }

  const browser = await getBrowser()
  const page = await browser.newPage({})
  const pageErrors: Error[] = []
  const consoleLogs: { type: string, text: string }[] = []

  page.on('console', (message) => {
    consoleLogs.push({
      type: message.type(),
      text: message.text()
    })
  })
  page.on('pageerror', (err) => {
    pageErrors.push(err)
  })

  if (path) {
    await page.goto(url(path), { waitUntil: 'networkidle' })
  }

  return {
    page,
    pageErrors,
    consoleLogs
  }
}

export async function expectNoClientErrors (path: string) {
  const ctx = useTestContext()
  if (!ctx.options.browser) {
    return
  }

  const { pageErrors, consoleLogs } = (await renderPage(path))!

  const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
  const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warning')

  expect(pageErrors).toEqual([])
  expect(consoleLogErrors).toEqual([])
  expect(consoleLogWarnings).toEqual([])
}

export async function withLogs (callback: (page: Page, logs: string[]) => Promise<void>) {
  let done = false
  const page = await createPage()
  const logs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (done) {
      throw new Error('Test finished prematurely')
    }
    logs.push(text)
  })

  try {
    await callback(page, logs)
  } finally {
    done = true
  }
}
