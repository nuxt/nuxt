/**
 * Ad-hoc inner-loop probe: starts `nuxt dev` against a fixture, performs a set
 * of edits, and reports the save -> SSR-reflects-it latency for each, along with
 * whatever the dev server logged in between.
 *
 * Unlike `dev-bench.ts` this is meant for interactive investigation, not for
 * recording comparable numbers.
 */
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'

const args = process.argv.slice(2)
const get = (flag: string, fallback?: string) => {
  const i = args.indexOf(flag)
  return i === -1 ? fallback : args[i + 1]
}

const fixture = get('--fixture', '.bench/large')!
const port = Number(get('--port', '3390'))
const repeats = Number(get('--repeats', '3'))
const cwd = process.cwd()
const fixtureDir = resolve(cwd, fixture)

let output = ''
const child = spawn(process.execPath, [
  resolve(cwd, 'node_modules/@nuxt/cli/bin/nuxi.mjs'),
  'dev',
  fixture,
  '--no-fork',
  '--port',
  String(port),
], {
  cwd,
  env: { ...process.env, NODE_ENV: 'development', NUXT_TELEMETRY_DISABLED: '1', NUXT_IGNORE_LOCK: '1', FORCE_COLOR: '0', DEBUG: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout!.on('data', (d) => { output += d.toString() })
child.stderr!.on('data', (d) => { output += d.toString() })

const url = `http://localhost:${port}`
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function waitFor (fn: () => Promise<boolean>, what: string, timeout = 60_000) {
  const start = performance.now()
  while (performance.now() - start < timeout) {
    if (await fn()) { return performance.now() - start }
    await sleep(10)
  }
  throw new Error(`timeout waiting for ${what}`)
}

await waitFor(async () => {
  try { return (await fetch(url + '/', { signal: AbortSignal.timeout(3000) })).status > 0 } catch { return false }
}, 'dev server')

async function scenario (name: string, path: string, mutate: (src: string, token: string) => string, check: (token: string) => Promise<boolean>) {
  const results: number[] = []
  for (let i = 0; i < repeats; i++) {
    const token = `probe-${Date.now()}-${i}`
    const source = readFileSync(path, 'utf8')
    const mark = output.length
    const start = performance.now()
    writeFileSync(path, mutate(source, token), 'utf8')
    try {
      await waitFor(() => check(token), name)
      results.push(performance.now() - start)
    } catch (error) {
      console.log(`  ${name}: ${(error as Error).message}`)
    }
    const logs = output.slice(mark).split('\n').filter(l => l.includes('Generated app in') || l.includes('restart') || l.includes('reload'))
    for (const line of logs) { console.log(`      | ${line.trim()}`) }
  }
  console.log(`${name.padEnd(22)} ${results.map(r => Math.round(r)).join(', ')} ms`)
}

const ssrContains = (token: string) => fetch(url + '/', { signal: AbortSignal.timeout(30_000) }).then(r => r.text()).then(t => t.includes(token)).catch(() => false)

const component = resolve(fixtureDir, 'app/components/Widget0000.vue')
const page = resolve(fixtureDir, 'app/pages/index.vue')
const serverRoute = resolve(fixtureDir, 'server/api/bench-0.ts')
const unused = resolve(fixtureDir, 'app/components/Widget0500.vue')

await scenario('component', component, (src, token) => src.replace(/(class="hmr-marker">)[^<]*/, `$1${token}`), ssrContains)
await scenario('page', page, (src, token) => src.replace(/(class="hmr-page-marker">)[^<]*/, `$1${token}`), ssrContains)
await scenario('component style only', component, src => src.replace(/(\.widget-0000\s*\{[^}]*color:\s*)#[0-9a-f]{6}/, (_m, p) => `${p}#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`), async () => {
  await sleep(400)
  return true
})
await scenario('unrelated component', unused, (src, token) => src.replace(/(class="hmr-marker">)[^<]*/, `$1${token}`), async () => {
  await sleep(400)
  return true
})
await scenario('server route', serverRoute, (_src, token) => `import { defineHandler } from 'h3'\n\nexport default defineHandler(() => ({ route: 0, token: '${token}' }))\n`, token => fetch(`${url}/api/bench-0`, { signal: AbortSignal.timeout(30_000) }).then(r => r.text()).then(t => t.includes(token)).catch(() => false))

child.kill('SIGTERM')
await sleep(1500)
child.kill('SIGKILL')
process.exit(0)
