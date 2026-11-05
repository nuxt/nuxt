import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { rm } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { join } from 'pathe'
import { withQuery } from 'ufo'
import { build, loadNuxt } from 'nuxt'
import { chromium } from 'playwright-core'
import type { Browser } from 'playwright-core'
import { getIslandHash, serializeIslandProps } from '../packages/nuxt/src/app/island-hash'
import { prepareIslandsV2App } from './fixtures/server-components/islands-v2-app'

type Impl = 'legacy' | 'v2'

// mirrors `CASES` in test/fixtures/server-components/app/pages/bench/[c].vue
const CASES = {
  s: { rows: 10, clients: 0, slots: 0 },
  m: { rows: 200, clients: 5, slots: 2 },
  l: { rows: 2000, clients: 20, slots: 5 },
  c: { rows: 50, clients: 50, slots: 0 },
  sl: { rows: 50, clients: 0, slots: 20 },
}
const IMPLS: Impl[] = ['legacy', 'v2']
const BROWSER_CASES = ['s', 'l', 'c'] as const
const HTTP_OPTS = { time: 1000, iterations: 20 }
const BROWSER_OPTS = { time: 0, iterations: 10, warmupIterations: 2 }

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureDir = join(repoRoot, 'test/fixtures/server-components')
const outRoot = join(repoRoot, 'node_modules/.test/islands-bench')
const servers = {} as Record<Impl, { url: string, proc: ChildProcess }>
let browser: Browser
// captured before nuxt wraps the global console
const log = console.log.bind(console)

describe('islands', () => {
  beforeAll(async () => {
    for (const impl of IMPLS) {
      await buildFixture(impl)
      servers[impl] = await startServer(join(outRoot, impl, 'output/server/index.mjs'))
    }
    browser = await chromium.launch()
  }, 600_000)

  afterAll(async () => {
    await browser?.close()
    for (const impl of IMPLS) { servers[impl]?.proc.kill() }
  })

  test('payload sizes', async () => {
    for (const impl of IMPLS) {
      for (const c of Object.keys(CASES)) {
        const html = await fetch(servers[impl].url + `/bench/${c}`).then(r => r.text())
        const data = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? ''
        // guards against both builds silently using the same islands implementation
        expect(html.includes('data-island-uid')).toBe(impl === 'legacy')
        log(`[payload] ${impl} ${c}: html ${size(html)}, __NUXT_DATA__ ${size(data)}`)
      }
    }
  })

  for (const [c, props] of Object.entries(CASES)) {
    test(`${c} ssr page`, async ({ bench }) => {
      await bench.compare(...IMPLS.map(impl => bench(`${impl} ${c} ssr page`, async () => {
        const res = await fetch(servers[impl].url + `/bench/${c}`)
        expect(res.status).toBe(200)
        expect(await res.text()).toContain(`bench ${c}`)
      })), HTTP_OPTS)
    })

    test(`${c} island endpoint`, async ({ bench }) => {
      await bench.compare(...IMPLS.map(impl => bench(`${impl} ${c} island endpoint`, async () => {
        const res = await fetch(servers[impl].url + islandURL('BenchIsland', props))
        expect(res.status).toBe(200)
        await res.text()
      })), HTTP_OPTS)
    })
  }

  for (const c of BROWSER_CASES) {
    test(`${c} hydration`, async ({ bench }) => {
      await bench.compare(...IMPLS.map(impl => bench(`${impl} ${c} hydration`, async () => {
        const page = await browser.newPage()
        try {
          await page.goto(servers[impl].url + `/bench/${c}`)
          await page.waitForFunction(() => (window as any).__bench?.suspenseAt)
          const duration = await page.evaluate(() => (window as any).__bench.suspenseAt - (window as any).__bench.entryAt)
          return { overriddenDuration: duration }
        } finally {
          await page.close()
        }
      })), BROWSER_OPTS)
    }, 120_000)

    test(`${c} refresh`, async ({ bench }) => {
      const pages = await Promise.all(IMPLS.map(async (impl) => {
        const page = await browser.newPage()
        await page.goto(servers[impl].url + `/bench/${c}`)
        await page.waitForFunction(() => (window as any).__bench?.suspenseAt)
        return page
      }))
      try {
        await bench.compare(...IMPLS.map((impl, i) => bench(`${impl} ${c} refresh`, async () => {
          const duration: number = await pages[i]!.evaluate(() => (window as any).__benchRefresh())
          return { overriddenDuration: duration }
        })), BROWSER_OPTS)
      } finally {
        await Promise.all(pages.map(p => p.close()))
      }
    }, 120_000)
  }
})

async function buildFixture (impl: Impl) {
  const dir = join(outRoot, impl)
  await rm(dir, { recursive: true, force: true })
  // the fixture config reads this at load time; `test/matrix.ts` may be cached by then, so override too
  if (impl === 'v2') { process.env.TEST_ISLANDS = 'v2' }
  try {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      ready: true,
      overrides: {
        buildDir: join(dir, '.nuxt'),
        nitro: { output: { dir: join(dir, 'output') } },
        sourcemap: false,
        experimental: { componentIslands: impl === 'v2' ? 'v2' : { selectiveClient: 'deep' } },
        // the fixture config may be cached from the legacy build, so the islands v2 `srcDir` is passed here too
        ...(impl === 'v2' ? { srcDir: prepareIslandsV2App(fixtureDir, 'app-islands-v2-bench') } : {}),
      },
    })
    await build(nuxt)
    await nuxt.close()
  } finally {
    delete process.env.TEST_ISLANDS
  }
}

async function startServer (entry: string) {
  const port = await getFreePort()
  const url = `http://127.0.0.1:${port}`
  const proc = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port), NITRO_PORT: String(port), HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1' },
    stdio: 'ignore',
  })
  for (let i = 0; i < 300; i++) {
    if (await fetch(url).then(() => true, () => false)) { return { url, proc } }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  proc.kill()
  throw new Error(`server ${entry} did not start`)
}

function getFreePort () {
  return new Promise<number>((resolve, reject) => {
    const srv = createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => resolve(port))
    }).on('error', reject)
  })
}

function islandURL (name: string, props: Record<string, any>) {
  const serializedProps = serializeIslandProps(props)
  const hashId = getIslandHash({ name, props: serializedProps, context: {} })
  return withQuery(`/__nuxt_island/${name}_${hashId}.json`, { props: serializedProps })
}

function size (str: string) {
  return `${Buffer.byteLength(str)}B (gzip ${gzipSync(str).byteLength}B)`
}
