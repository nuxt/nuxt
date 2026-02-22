import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getRandomPort } from 'get-port-please'
import { exec } from 'tinyexec'
import { expect, test } from '@playwright/test'
import { isDev } from '../matrix'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixtureDir = fileURLToPath(new URL('../fixtures/prerender-query-reactivity-static', import.meta.url))
const publicDir = resolve(fixtureDir, '.output/public')

let server: ReturnType<typeof createServer> | undefined
let baseURL = ''

test.skip(isDev, 'Static prerender regression only runs in production mode')

test.beforeAll(async () => {
  await exec('pnpm', ['nuxt', 'generate', fixtureDir], {
    nodeOptions: {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  })

  const port = await getRandomPort('127.0.0.1')
  baseURL = `http://127.0.0.1:${port}`
  server = createStaticServer(publicDir)

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject)
    server!.listen(port, '127.0.0.1', () => resolve())
  })
}, 120_000)

test.afterAll(async () => {
  if (!server) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    server!.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
})

test('applies query-based class after hydration in prerendered static output', async ({ page }) => {
  await page.goto(`${baseURL}/?preview=true`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.useNuxtApp?.().isHydrating === false)

  const state = await page.evaluate(() => {
    const nuxtApp = window.useNuxtApp?.()
    const mode = document.querySelector('[data-testid="mode"]')

    return {
      routeQuery: nuxtApp?._route?.query?.preview ?? null,
      className: mode?.className ?? null,
      backgroundColor: mode ? getComputedStyle(mode).backgroundColor : null,
    }
  })

  expect(state.routeQuery).toBe('true')
  expect(
    state.className,
    `query true but class not preview-mode (got "${state.className}")`,
  ).toBe('preview-mode')
  expect(state.backgroundColor).toBe('rgb(255, 0, 0)')
})

function createStaticServer (rootDir: string) {
  return createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
      const requestedPath = resolve(rootDir, `.${pathname}`)
      if (requestedPath !== rootDir && !requestedPath.startsWith(rootDir + '/')) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }

      const filePath = await resolveStaticFile(rootDir, requestedPath, pathname)
      if (!filePath) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }

      const content = await readFile(filePath)
      res.statusCode = 200
      res.setHeader('Content-Type', getContentType(filePath))
      res.end(content)
    } catch {
      res.statusCode = 500
      res.end('Server Error')
    }
  })
}

async function resolveStaticFile (rootDir: string, requestedPath: string, pathname: string) {
  const candidates = [requestedPath, join(requestedPath, 'index.html')]
  if (!extname(pathname)) {
    candidates.push(join(rootDir, 'index.html'))
  }

  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => undefined)
    if (info?.isFile()) {
      return candidate
    }
  }
}

function getContentType (filePath: string) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
  }[extname(filePath).toLowerCase()] || 'application/octet-stream'
}
