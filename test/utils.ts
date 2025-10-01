import { Script, createContext } from 'node:vm'
import { expect, vi } from 'vitest'
import type { Page } from 'playwright-core'
import { parse } from 'devalue'
import { reactive, ref, shallowReactive, shallowRef } from 'vue'
import { createError } from 'h3'
import { getBrowser, url, useTestContext } from '@nuxt/test-utils/e2e'
import { isCI } from 'std-env'

export const isRenderingJson = process.env.TEST_PAYLOAD !== 'js'

export async function renderPage (path = '/', opts?: { retries?: number }) {
  const ctx = useTestContext()
  if (!ctx.options.browser) {
    throw new Error('`renderPage` require `options.browser` to be set')
  }

  const browser = await getBrowser()
  const page = await browser.newPage({})
  const pageErrors: Error[] = []
  const requests: string[] = []
  const consoleLogs: { type: string, text: string }[] = []

  page.on('console', (message) => {
    consoleLogs.push({
      type: message.type(),
      text: message.text(),
    })
  })
  page.on('pageerror', (err) => {
    pageErrors.push(err)
  })
  page.on('request', (req) => {
    try {
      requests.push(req.url().replace(url('/'), '/'))
    } catch {
      // TODO
    }
  })

  if (path) {
    await gotoPath(page, path, opts?.retries)
  }

  return {
    page,
    pageErrors,
    requests,
    consoleLogs,
  }
}

export async function expectNoClientErrors (path: string) {
  const ctx = useTestContext()
  if (!ctx.options.browser) {
    return
  }

  const { page, pageErrors, consoleLogs } = (await renderPage(path))!

  expect(pageErrors).toEqual([])
  expectNoErrorsOrWarnings(consoleLogs)

  await page.close()
}

export function expectNoErrorsOrWarnings (consoleLogs: Array<{ type: string, text: string }>) {
  const consoleLogErrors = consoleLogs.filter(i => i.type === 'error')
  const consoleLogWarnings = consoleLogs.filter(i => i.type === 'warning')

  expect(consoleLogErrors).toEqual([])
  expect(consoleLogWarnings).toEqual([])
}

const BASE_TIMEOUT = isCI ? 6_000 : 3_000
export async function gotoPath (page: Page, path: string, retries = 0) {
  await vi.waitFor(() => page.goto(url(path), { timeout: BASE_TIMEOUT }), { timeout: BASE_TIMEOUT * retries || BASE_TIMEOUT })
  await page.waitForFunction(path => window.useNuxtApp?.()._route.fullPath === path && !window.useNuxtApp?.().isHydrating, path)
}

const revivers = {
  NuxtError: (data: any) => createError(data),
  EmptyShallowRef: (data: any) => shallowRef(JSON.parse(data)),
  EmptyRef: (data: any) => ref(JSON.parse(data)),
  ShallowRef: (data: any) => shallowRef(data),
  ShallowReactive: (data: any) => shallowReactive(data),
  Island: (key: any) => key,
  Ref: (data: any) => ref(data),
  Reactive: (data: any) => reactive(data),
  // test fixture reviver only
  BlinkingText: () => '<revivified-blink>',
}
export function parsePayload (payload: string) {
  return parse(payload || '', revivers)
}
export function parseData (html: string) {
  if (!isRenderingJson) {
    const { script = '' } = html.match(/<script>(?<script>window.__NUXT__.*?)<\/script>/)?.groups || {}
    const _script = new Script(script)
    return {
      script: _script.runInContext(createContext({ window: {} })),
      attrs: {},
    }
  }

  const regexp = /<script type="application\/json" data-nuxt-data="[^"]+"(?<attrs>[^>]+)>(?<script>.*?)<\/script>/
  const { script, attrs = '' } = html.match(regexp)?.groups || {}
  const _attrs: Record<string, string> = {}
  for (const attr of attrs.matchAll(/( |^)(?<key>[\w-]+)="(?<value>[^"]+)"/g)) {
    _attrs[attr!.groups!.key!] = attr!.groups!.value!
  }
  return {
    script: parsePayload(script || ''),
    attrs: _attrs,
  }
}
