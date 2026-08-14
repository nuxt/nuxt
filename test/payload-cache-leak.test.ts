import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isWindows } from 'std-env'
import { fetch, setup } from '@nuxt/test-utils/e2e'

import { isDev, runsOncePerEnvInMatrix } from './matrix'

// Regression coverage: a runtime payload cache keyed by path only would replay one
// principal's `/_payload.json` to other users before middleware/guards ran. Two rule
// shapes are covered: a `cache` route with `varies` + middleware (cross-user), and an
// `isr` route with `appMiddleware` (unauthenticated).

const USER_A = 'userA'
const USER_B = 'userB'
const MARKER_A = `MARKER-${USER_A}`
const MARKER_B = `MARKER-${USER_B}`

const payloadFile = '_payload.json'

// Only exercise this once per environment (dev + built); the leak is builder-independent.
const shouldRun = runsOncePerEnvInMatrix

if (shouldRun) {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/payload-cache-leak', import.meta.url)),
    dev: isDev,
    server: true,
    setupTimeout: (isWindows ? 360 : 120) * 1000,
    nuxtConfig: {
      hooks: {
        'modules:done' () {
          if (!isDev) {
            process.env.NODE_ENV = 'production'
          }
        },
      },
    },
  })
}

async function get (path: string, headers?: Record<string, string>) {
  const res = await fetch(path, headers ? { headers } : undefined)
  return { status: res.status, text: await res.text() }
}

const cookie = (user: string) => ({ cookie: `session=${user}` })

describe.skipIf(!shouldRun)('payload cache cross-user / unauthenticated disclosure (GHSA-wm8w-6qjm-cv43)', () => {
  it('does not serve a protected payload to an unauthenticated request before any warm', async () => {
    const res = await get(`/protected/cache-cookie/${payloadFile}`)
    expect(res.text).not.toContain(MARKER_A)
    expect(res.text).not.toContain(MARKER_B)
    expect(res.text).not.toContain('secret-for-')
  })

  // this will pass on the next version of nitro
  describe('cache + cache.varies:[cookie] + named middleware', () => {
    const page = '/protected/cache-cookie'

    it.fails('warms as user A', async () => {
      const res = await get(page, cookie(USER_A))
      expect(res.status).toBe(200)
      expect(res.text).toContain(MARKER_A)
    })

    it.fails('never returns user A payload to user B, and re-renders B their own payload', async () => {
      const res = await get(`${page}/${payloadFile}`, cookie(USER_B))
      expect(res.text).not.toContain(MARKER_A)
      expect(res.text).not.toContain('secret-for-userA')
      expect(res.text).toContain(MARKER_B)
    })

    it.fails('serves user B only their own data over HTML and payload', async () => {
      const html = await get(page, cookie(USER_B))
      expect(html.text).toContain(MARKER_B)
      expect(html.text).not.toContain(MARKER_A)
    })
  })

  describe('isr + routeRules.appMiddleware', () => {
    const page = '/protected/isr-appmw'

    it('warms as user A', async () => {
      const res = await get(page, cookie(USER_A))
      expect(res.status).toBe(200)
      expect(res.text).toContain(MARKER_A)
    })

    it('never returns user A payload to an unauthenticated request', async () => {
      const res = await get(`${page}/${payloadFile}`)
      expect(res.text).not.toContain(MARKER_A)
      expect(res.text).not.toContain('secret-for-userA')
    })
  })
})
