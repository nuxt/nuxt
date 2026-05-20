import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dirname, join, resolve } from 'pathe'

const require = createRequire(import.meta.url)

const repoRoot = resolve(import.meta.dirname, '../../..')
const fixtureSrc = resolve(repoRoot, 'test/fixtures/sibling-layer-types')

/**
 * The fixture's `package.json` files reference the in-repo Nuxt packages via
 * `link:__NUXT__` etc. placeholders so the same fixture works regardless of
 * where the repo is checked out. We substitute the placeholders for absolute
 * paths when copying the fixture to its temp directory.
 */
const linkMap: Record<string, string> = {
  __NUXT__: resolve(repoRoot, 'packages/nuxt'),
  __KIT__: resolve(repoRoot, 'packages/kit'),
  __SCHEMA__: resolve(repoRoot, 'packages/schema'),
  __VITE__: resolve(repoRoot, 'packages/vite'),
  __NITRO_SERVER__: resolve(repoRoot, 'packages/nitro-server'),
}

function substituteLinks (dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.nuxt') { continue }
      substituteLinks(full)
    } else if (entry === 'package.json') {
      let content = readFileSync(full, 'utf8')
      for (const [placeholder, abs] of Object.entries(linkMap)) {
        content = content.replaceAll(placeholder, abs)
      }
      writeFileSync(full, content)
    }
  }
}

function run (cmd: string, args: string[], cwd: string) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'development' },
  })
  if (result.status !== 0) {
    throw new Error(`\`${cmd} ${args.join(' ')}\` in ${cwd} exited ${result.status}:\n${result.stdout}\n${result.stderr}`)
  }
  return result
}

/**
 * Drives `tsserver` directly the way VS Code's Volar extension does, with
 * `@vue/typescript-plugin` loaded as a global plugin, so the tests assert
 * against the actual inferred types in the project, not just the shape of
 * the generated tsconfig. CLI tools like `vue-tsc -b` walk from the consumer
 * down through references and never hit the disagreement that breaks
 * tsserver's nearest-tsconfig walk; only this kind of driver can catch the
 * IDE-only regression from #34763.
 */
class TsServer {
  child: ReturnType<typeof spawn>
  seq = 0
  pending = new Map<number, (msg: any) => void>()
  events: any[] = []
  buf = ''

  constructor (cwd: string, tsserverPath: string, pluginProbeLocation: string) {
    this.child = spawn(process.execPath, [
      tsserverPath,
      '--globalPlugins', '@vue/typescript-plugin',
      '--pluginProbeLocations', pluginProbeLocation,
      '--allowLocalPluginLoads',
    ], { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
    this.child.stdout!.setEncoding('utf8')
    this.child.stdout!.on('data', chunk => this.onData(chunk))
    this.child.stderr!.on('data', () => { /* swallow */ })
  }

  onData (chunk: string) {
    this.buf += chunk
    let idx
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line || line.startsWith('Content-Length')) { continue }
      try {
        const msg = JSON.parse(line)
        if (msg.type === 'response') {
          const cb = this.pending.get(msg.request_seq)
          if (cb) { this.pending.delete(msg.request_seq); cb(msg) }
        } else if (msg.type === 'event') {
          this.events.push(msg)
        }
      } catch {
        // ignore non-JSON banners
      }
    }
  }

  send (command: string, args?: any): Promise<any> {
    const req = { seq: ++this.seq, type: 'request', command, arguments: args }
    this.child.stdin!.write(JSON.stringify(req) + '\n')
    return new Promise(res => this.pending.set(req.seq, res))
  }

  notify (command: string, args?: any) {
    const req = { seq: ++this.seq, type: 'request', command, arguments: args }
    this.child.stdin!.write(JSON.stringify(req) + '\n')
  }

  async close () {
    this.child.kill()
    await new Promise(r => this.child.on('exit', r))
  }
}

function findPosition (src: string, needle: string, offsetInMatch = 0) {
  const idx = src.indexOf(needle) + offsetInMatch
  const line = src.slice(0, idx).split('\n').length
  const offset = idx - (src.lastIndexOf('\n', idx - 1) + 1) + 1
  return { line, offset }
}

describe.sequential('external sibling layer typescript inference', () => {
  let tmpRoot: string
  let consumerDir: string
  let consumerPage: string
  let server: TsServer | undefined

  beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'nuxt-sibling-layer-types-'))
    cpSync(fixtureSrc, tmpRoot, {
      recursive: true,
      filter: src => !src.includes('node_modules') && !src.endsWith('.nuxt') && !src.endsWith('pnpm-lock.yaml'),
    })
    substituteLinks(tmpRoot)

    consumerDir = resolve(tmpRoot, 'my-nuxt-app')
    const layerDir = resolve(tmpRoot, 'base')
    consumerPage = resolve(consumerDir, 'app/pages/index.vue')

    // Install each project separately with `--ignore-workspace` so the layer
    // and consumer get distinct `node_modules` stores (in particular, distinct
    // physical paths for `vue`, `@nuxt/ui`, etc.). This is the precondition
    // that triggers the IDE-only failure mode from #34763 in real-world
    // setups.
    run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], layerDir)
    run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], consumerDir)
    // `postinstall: nuxt prepare` should have run, but be explicit.
    run('pnpm', ['exec', 'nuxt', 'prepare'], layerDir)
    run('pnpm', ['exec', 'nuxt', 'prepare'], consumerDir)

    const tsserverPath = require.resolve('typescript/lib/tsserver.js', { paths: [consumerDir] })
    const pluginPkgJson = require.resolve('@vue/typescript-plugin/package.json', { paths: [consumerDir] })
    const probeDir = dirname(dirname(dirname(pluginPkgJson)))

    server = new TsServer(consumerDir, tsserverPath, probeDir)
    await server.send('configurePlugin', {
      pluginName: '@vue/typescript-plugin',
      configuration: { hybridMode: false, typescriptPluginOptions: {} },
    })
    await server.send('open', {
      file: consumerPage,
      fileContent: readFileSync(consumerPage, 'utf8'),
      projectRootPath: consumerDir,
    })
    // give tsserver a beat to load projects + Volar virtual files
    await new Promise(r => setTimeout(r, 2000))
  }, 240_000)

  afterAll(async () => {
    await server?.close()
    writeFileSync('/tmp/sibling-tmproot.txt', tmpRoot)
  })

  it('resolves `<AppButton>` (re-exported from a sibling layer) to a typed `DefineComponent`, not `any`', async () => {
    const src = readFileSync(consumerPage, 'utf8')
    const pos = findPosition(src, 'AppButton', 1)
    const qi = await server!.send('quickinfo', { file: consumerPage, ...pos })
    const display = qi.body?.displayString ?? ''
    expect(display, 'expected typed DefineComponent, got: ' + display).toMatch(/DefineComponent</)
    // The user-reported failure mode from #34763 shows up as
    // `(property) AppButton: any` or `DefineComponent<any, ...>`.
    expect(display).not.toMatch(/AppButton:\s*any\b/)
    expect(display).not.toMatch(/DefineComponent<\s*any\s*,/)
    // `ButtonProps` is the prop type the layer SFC imported from `@nuxt/ui`.
    // If the consumer's project sees `@nuxt/ui` at a different physical path
    // than the layer (separate `node_modules` stores), `ButtonProps`
    // collapses and the displayed component type drops it.
    expect(display, 'expected ButtonProps in component type, got: ' + display).toMatch(/ButtonProps/)
  })

  it('flags an invalid prop value on `<AppButton size="not-a-valid-size" />`', async () => {
    // This is the stronger check: even if `<AppButton>` resolves to a
    // `DefineComponent<ButtonProps, ...>`, the consumer's view of
    // `ButtonProps.size` could still degrade to `any` (or to `string`
    // without the literal union) when the consumer and layer disagree on
    // the identity of `@nuxt/ui`. Asserting that an invalid literal raises
    // a diagnostic proves the prop union is fully resolved.
    server!.events.length = 0
    server!.notify('geterr', { files: [consumerPage], delay: 0 })
    const start = Date.now()
    while (Date.now() - start < 5000) {
      if (server!.events.some(e => e.event === 'semanticDiag' && e.body?.file === consumerPage)) { break }
      await new Promise(r => setTimeout(r, 100))
    }
    const diags = server!.events
      .filter(e => e.event === 'semanticDiag' && e.body?.file === consumerPage)
      .flatMap(e => e.body!.diagnostics)
    const sizeMismatch = diags.find((d: any) => /not assignable to type/i.test(d.text) && /size/i.test(JSON.stringify(d)))
    expect(sizeMismatch, 'expected a `size` type mismatch diagnostic; got: ' + JSON.stringify(diags)).toBeTruthy()
  })
})
