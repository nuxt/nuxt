import { Script, createContext } from 'node:vm'
import { expect } from 'vitest'
import type { Page } from 'playwright'
import { parse } from 'devalue'
import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import { createError } from 'h3'
import { createPage, getBrowser, url, useTestContext } from '@nuxt/test-utils'

export const isRenderingJson = process.env.TEST_PAYLOAD !== 'js'

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

const revivers = {
  NuxtError: (data: any) => createError(data),
  EmptyShallowRef: (data: any) => shallowRef(JSON.parse(data)),
  EmptyRef: (data: any) => ref(JSON.parse(data)),
  ShallowRef: (data: any) => shallowRef(data),
  ShallowReactive: (data: any) => shallowReactive(data),
  Ref: (data: any) => ref(data),
  Reactive: (data: any) => reactive(data),
  // test fixture reviver only
  BlinkingText: () => '<revivified-blink>'
}
export function parsePayload (payload: string) {
  return parse(payload || '', revivers)
}
export function parseData (html: string) {
  if (!isRenderingJson) {
    const { script } = html.match(/<script>(?<script>window.__NUXT__.*?)<\/script>/)?.groups || {}
    const _script = new Script(script)
    return {
      script: _script.runInContext(createContext({ window: {} })),
      attrs: {}
    }
  }
  const { script, attrs } = html.match(/<script type="application\/json" id="__NUXT_DATA__"(?<attrs>[^>]+)>(?<script>.*?)<\/script>/)?.groups || {}
  const _attrs: Record<string, string> = {}
  for (const attr of attrs.matchAll(/( |^)(?<key>[\w-]+)+="(?<value>[^"]+)"/g)) {
    _attrs[attr!.groups!.key] = attr!.groups!.value
  }
  return {
    script: parsePayload(script || ''),
    attrs: _attrs
  }
}
