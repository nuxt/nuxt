import { expect } from 'vitest'
import type { Page } from 'playwright'
import { parse } from 'devalue'
import { isShallow, isRef, isReactive, toRaw } from 'vue'
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

  const { page, pageErrors, consoleLogs } = (await renderPage(path))!

  const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
  const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warning')

  expect(pageErrors).toEqual([])
  expect(consoleLogErrors).toEqual([])
  expect(consoleLogWarnings).toEqual([])

  await page.close()
}

type EqualityVal = string | number | boolean | null | undefined | RegExp
export async function expectWithPolling (
  get: () => Promise<EqualityVal> | EqualityVal,
  expected: EqualityVal,
  retries = process.env.CI ? 100 : 30,
  delay = process.env.CI ? 500 : 100
) {
  let result: EqualityVal
  for (let i = retries; i >= 0; i--) {
    result = await get()
    if (result?.toString() === expected?.toString()) {
      break
    }
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  expect(result?.toString(), `"${result?.toString()}" did not equal "${expected?.toString()}" in ${retries * delay}ms`).toEqual(expected?.toString())
}

export async function withLogs (callback: (page: Page, logs: string[]) => Promise<void>) {
  let done = false
  const page = await createPage()
  const logs: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (done && !text.includes('[vite] server connection lost')) {
      throw new Error(`Test finished prematurely before log: [${msg.type()}] ${text}`)
    }
    logs.push(text)
  })

  try {
    await callback(page, logs)
  } finally {
    done = true
    await page.close()
  }
}

const isNuxtError = (err: any) => !!(err && typeof err === 'object' && ('__nuxt_error' in err))
const reducers = {
  NuxtError: (data: any) => isNuxtError(data) && data.toJSON(),
  shallowRef: (data: any) => isRef(data) && isShallow(data) && data.value,
  ref: (data: any) => isRef(data) && data.value,
  reactive: (data: any) => isReactive(data) && toRaw(data)
}
export function parseData (html: string) {
  const { script, attrs } = html.match(/<script type="application\/json" id="__NUXT_DATA__"(?<attrs>[^>]+)>(?<script>.*?)<\/script>/)?.groups || {}
  const _attrs: Record<string, string> = {}
  for (const attr of attrs.matchAll(/( |^)(?<key>[\w-]+)+="(?<value>[^"]+)"/g)) {
    _attrs[attr!.groups!.key] = attr!.groups!.value
  }
  return {
    script: parse(script || '', reducers),
    attrs: _attrs
  }
}
