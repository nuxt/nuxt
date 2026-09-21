import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearServerLogs, fetch, getServerLogs, setup } from '@nuxt/test-utils/e2e'

import { asyncContext, isDev, isTestingAppManifest, isWebpack, projectSuffix } from './matrix'
import { copyFixture, renderErrorPage, sourcePosition } from './dev-error-utils'

const runs = isDev && !isWebpack && !asyncContext && isTestingAppManifest

const fixtureURL = runs
  ? copyFixture('dev-error-sourcemap', `dev-error-server-${projectSuffix}`)
  : new URL('./fixtures/dev-error-sourcemap/', import.meta.url)
const at = (file: string, needle: string) => sourcePosition(fixtureURL, file, needle)

if (runs) {
  await setup({
    rootDir: fileURLToPath(fixtureURL),
    dev: true,
    server: true,
    browser: false,
    setupTimeout: 240 * 1000,
    serverStartTimeout: 240 * 1000,
  })
}

/** Wait for the dev server to flush a report for `path`, and return everything it logged. */
async function reportedLogs (path: string, options: { accept: string }) {
  clearServerLogs()
  const res = await fetch(path, { headers: { accept: options.accept } })
  await res.text()
  await expect.poll(() => getServerLogs().join('\n').includes('[request error]'), { timeout: 10_000 }).toBe(true)
  return { status: res.status, log: getServerLogs().join('\n') }
}

describe.skipIf(!runs)('dev ssr error reporting for json requests', () => {
  beforeEach(() => clearServerLogs())

  it('prints one report with a mapped server frame and a code frame for a failing api handler', async () => {
    const { log, status } = await reportedLogs('/api/boom', { accept: 'application/json' })
    const boom = at('server/api/boom.ts', 'new Error')

    expect(status).toBe(500)
    expect(log.match(/\[request error\]/g)).toHaveLength(1)
    expect(log).toContain(`server/api/boom.ts:${boom.line}:${boom.column}`)
    expect(log).toContain('│')
    expect(log).toContain('boom from an api handler')
  })

  it('prints one report with a mapped page frame for a failing page requested as json', async () => {
    const { log, status } = await reportedLogs('/boom-page', { accept: 'application/json' })
    const boom = at('app/pages/boom-page.vue', 'new Error')

    expect(status).toBe(500)
    expect(log.match(/\[request error\]/g)).toHaveLength(1)
    expect(log).toContain(`app/pages/boom-page.vue:${boom.line}:${boom.column}`)
    expect(log).toContain('│')
  })

  it('responds to a json request with json, not the error page', async () => {
    const res = await fetch('/api/boom', { headers: { accept: 'application/json' } })

    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toMatchObject({ status: 500 })
  })
})

describe.skipIf(!runs)('dev ssr errors thrown from a page', () => {
  it('reports a thrown value that carries a status code, keeping the status', async () => {
    const { body, report, status } = await renderErrorPage('/teapot')

    expect(status).toBe(418)
    expect(body.match(/<nuxt-error-overlay>/g)).toHaveLength(1)
    expect(report).toBeDefined()
  })

  it('does not report an expected fatal 404', async () => {
    const res = await fetch('/expected-404', { headers: { accept: 'text/html' } })
    const body = await res.text()

    expect(res.status).toBe(404)
    expect(body).toContain('custom error page')
    expect(body).not.toContain('<nuxt-error-overlay>')
  })

  it('reports a fatal 500', async () => {
    const { report, status } = await renderErrorPage('/expected-500')

    expect(status).toBe(500)
    expect(report).toBeDefined()
  })

  it('responds with a 500 when the page throws null', async () => {
    const { report, status } = await renderErrorPage('/throw-null')

    expect(status).toBe(500)
    expect(report).toBeDefined()
  })

  it('reports a nuxt diagnostic with its code', async () => {
    const { report, status } = await renderErrorPage('/diagnostic')

    expect(status).toBe(500)
    expect(report).toMatchObject({ name: 'NUXT_E1001', code: 'NUXT_E1001' })
    expect(report.message).toContain('outside of a plugin')
  })

  it('links a nuxt diagnostic to its fix and docs', async () => {
    const { report } = await renderErrorPage('/diagnostic')

    expect(report.hint).toContain('Move this call inside')
    expect(report.docsUrl).toBe('https://nuxt.com/docs/4.x/errors/e1001')
  })

  it('carries the component trace and the route of the page that threw', async () => {
    const { report } = await renderErrorPage('/boom-page')

    expect(report.trace?.map(entry => entry.label)).toContain('<boom-page>')
    expect(report.sections.find(section => section.id === 'route')?.content).toMatchObject({ path: '/boom-page' })
  })
})
