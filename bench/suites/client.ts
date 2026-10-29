import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { waitForHttp } from '../lib/proc.ts'
import { formatBytes, formatDelta, markdownTable } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import { fixtureDir } from '../lib/suite.ts'
import { ensureBuilt, startProduction } from './render.ts'

interface PageWeight {
  html: number
  js: number
  jsFiles: number
  css: number
  cssFiles: number
}

interface ClientWeight {
  routes: Record<string, PageWeight>
  js: number
  jsFiles: number
}

const gzipSize = (contents: string | Uint8Array) => gzipSync(contents).byteLength

const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1]

function weigh (html: string, publicDir: string): PageWeight {
  const js = new Set<string>()
  const css = new Set<string>()
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
    const rel = attribute(tag, 'rel')
    if (tag.startsWith('<script') && attribute(tag, 'type') === 'module' && attribute(tag, 'src')) {
      js.add(attribute(tag, 'src')!)
    } else if (rel === 'modulepreload') {
      js.add(attribute(tag, 'href')!)
    } else if (rel === 'stylesheet') {
      css.add(attribute(tag, 'href')!)
    }
  }
  const size = (urls: Set<string>) => [...urls].reduce((total, url) => total + gzipSize(readFileSync(join(publicDir, new URL(url, 'http://localhost').pathname))), 0)
  return { html: gzipSize(html), js: size(js), jsFiles: js.size, css: size(css), cssFiles: css.size }
}

function clientJs (publicDir: string): Pick<ClientWeight, 'js' | 'jsFiles'> {
  const files = readdirSync(join(publicDir, '_nuxt'), { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.js'))
  return { js: files.reduce((total, file) => total + gzipSize(readFileSync(join(publicDir, '_nuxt', file))), 0), jsFiles: files.length }
}

export async function clientSuite ({ targets, fixtures, log }: SuiteContext): Promise<SuiteResult> {
  const rows: string[][] = []
  const headline: string[][] = []
  const data: Record<string, Record<string, ClientWeight>> = {}

  for (const fixture of fixtures) {
    for (const target of targets) {
      await ensureBuilt(target, fixture, message => log(`client: ${message}`))
    }

    log(`client: ${fixture.id}`)
    const weights = new Map<string, ClientWeight>()
    for (const target of targets) {
      const publicDir = join(fixtureDir(target, fixture), '.output/public')
      const { server, url } = startProduction(target, fixture)
      try {
        const routes: Record<string, PageWeight> = {}
        for (const route of fixture.routes) {
          await waitForHttp(url + route.path, { match: route.match, server, timeout: 30_000 })
          routes[route.path] = weigh(await (await fetch(url + route.path)).text(), publicDir)
        }
        weights.set(target.id, { routes, ...clientJs(publicDir) })
      } finally {
        await server.stop()
      }
    }

    const [baseline, head] = targets.map(target => weights.get(target.id)!) as [ClientWeight, ClientWeight]
    data[fixture.id] = { baseline, head }
    const row = (label: string, a: number, b: number, format: (n: number) => string = formatBytes) => [label, format(a), format(b), formatDelta(a, b)]
    for (const route of fixture.routes) {
      const a = baseline.routes[route.path]!
      const b = head.routes[route.path]!
      const label = `${fixture.id} / \`${route.path}\``
      rows.push(
        row(`${label} / JS`, a.js, b.js),
        row(`${label} / JS files`, a.jsFiles, b.jsFiles, String),
        row(`${label} / CSS`, a.css, b.css),
        row(`${label} / CSS files`, a.cssFiles, b.cssFiles, String),
        row(`${label} / HTML`, a.html, b.html),
      )
      headline.push([`initial JS, gzip (\`${route.path}\`, ${fixture.id})`, `${formatBytes(a.js)} in ${a.jsFiles}`, `${formatBytes(b.js)} in ${b.jsFiles}`, formatDelta(a.js, b.js)])
    }
    rows.push(
      row(`${fixture.id} / all client JS`, baseline.js, head.js),
      row(`${fixture.id} / all client JS files`, baseline.jsFiles, head.jsFiles, String),
    )
  }

  const markdown = [
    'Gzipped size of what each server-rendered route asks the browser to load before hydration: the entry script and every `modulepreload`, the stylesheets, and the HTML itself. Measured once from the last production build of each target. Apart from a few bytes of HTML that vary with the build id, these sizes are deterministic.',
    '',
    markdownTable(['Fixture / route / asset', 'baseline', 'head', 'delta'], rows),
  ].join('\n')

  return { markdown, headline, data }
}
