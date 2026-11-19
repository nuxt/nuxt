import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { dirname, join, normalize, resolve } from 'pathe'
import { rolldown } from 'rolldown'
import { resolveModulePath } from 'exsolve'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { createHooks } from 'hookable'
import type { NitroApp } from 'nitro/types'

const { flags } = vi.hoisted(() => ({ flags: { legacyCompat: false } }))

vi.mock('nitro', () => ({ definePlugin: (plugin: unknown) => plugin }))
vi.mock('#nuxt-compat/flags', () => ({
  get legacyCompat () { return flags.legacyCompat },
}))

async function setup (legacyCompat: boolean) {
  flags.legacyCompat = legacyCompat
  vi.resetModules()
  const { serverDiagnostics } = await import('../src/runtime/diagnostics.ts')
  const report = vi.spyOn(serverDiagnostics, 'NUXT_E8013').mockImplementation(() => ({}) as any)
  const { default: plugin } = await import('../src/runtime/plugins/dev-hooks.ts')
  const hooks = createHooks<Record<string, () => void>>()
  ;(plugin as (app: NitroApp) => void)({ hooks } as unknown as NitroApp)
  return { hooks, report, reported: () => report.mock.calls.map(([params]) => (params as { hook: string }).hook) }
}

describe('dev hooks plugin', () => {
  it('reports listeners for Nitro v2 hooks that are not emitted', async () => {
    const { hooks, report, reported } = await setup(false)
    const listener = vi.fn()
    hooks.hook('render:before', listener)
    hooks.hook('render:before', () => {})
    hooks.hookOnce('beforeResponse', () => {})
    hooks.hook('render:response', () => {})
    hooks.hook('render:html', () => {})
    hooks.hook('response', () => {})
    expect(reported()).toEqual(['render:before', 'beforeResponse', 'render:response'])
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ location: expect.stringMatching(/test[\\/]dev-hooks-plugin\.test\.ts$/) }))

    await hooks.callHook('render:before')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('names the code that registered a listener from inside the dev server bundle', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-dev-hooks-')))
    onTestFinished(() => rm(root, { recursive: true, force: true }))
    const registerAfterAwait = 'export default async (nitroApp) => {\n  await Promise.resolve()\n  nitroApp.hooks.hook(\'render:before\', () => {})\n}\n'
    const files = {
      'node_modules/@nuxtjs/i18n/dist/runtime/server/plugin.js': registerAfterAwait,
      'server/plugins/locale.js': registerAfterAwait,
      'node_modules/legacy-module/dist/runtime/plugin.js': registerAfterAwait,
    }
    for (const [file, code] of Object.entries(files)) {
      await mkdir(dirname(join(root, file)), { recursive: true })
      await writeFile(join(root, file), code)
    }

    const entry = [
      `import devHooks from ${JSON.stringify(resolve(import.meta.dirname, '../src/runtime/plugins/dev-hooks.ts'))}`,
      `import { wrapLegacyPlugin } from ${JSON.stringify(resolve(import.meta.dirname, '../src/runtime/compat/legacy-plugin.ts'))}`,
      ...Object.keys(files).map((file, index) => `import plugin${index} from ${JSON.stringify(join(root, file))}`),
      'const nitroApp = { hooks: { hook: () => () => {} } }',
      'devHooks(nitroApp)',
      'await plugin0(nitroApp)',
      'await plugin1(nitroApp)',
      'await wrapLegacyPlugin(plugin2)(nitroApp)',
    ].join('\n')
    const stubs: Record<string, string> = {
      'nitro': 'export const definePlugin = plugin => plugin',
      '#nuxt-compat/flags': 'export const legacyCompat = false',
      '../diagnostics': 'export const serverDiagnostics = { NUXT_E8013: params => console.log(JSON.stringify(params)) }',
      '../diagnostics.ts': 'export const serverDiagnostics = {}',
    }
    const build = await rolldown({
      input: 'entry',
      platform: 'node',
      plugins: [{
        name: 'stubs',
        resolveId: (id) => {
          if (id === 'errx') {
            return { id: pathToFileURL(resolveModulePath('errx', { from: import.meta.url })).href, external: true }
          }
          return id === 'entry' || id in stubs ? id : undefined
        },
        load: id => id === 'entry' ? entry : stubs[id],
      }],
    })
    await build.write({ dir: join(root, '.nuxt/dev'), entryFileNames: 'index.mjs', sourcemap: true })
    await build.close()

    const output = execFileSync(process.execPath, [join(root, '.nuxt/dev/index.mjs')], { encoding: 'utf8' })
    expect(output.trim().split('\n').map(line => JSON.parse(line)).map(report => ({ ...report, location: normalize(report.location) }))).toEqual([
      expect.objectContaining({ location: '@nuxtjs/i18n/dist/runtime/server/plugin.js', fix: expect.stringContaining('report the issue to its maintainers') }),
      expect.objectContaining({ location: join(root, 'server/plugins/locale.js'), fix: expect.stringContaining('server middleware') }),
      expect.objectContaining({ location: 'legacy-module/dist/runtime/plugin.js', fix: expect.stringContaining('report the issue to its maintainers') }),
    ])
  })

  it('leaves the hooks the compatibility layer bridges alone when it is active', async () => {
    const { hooks, reported } = await setup(true)
    hooks.hook('beforeResponse', () => {})
    hooks.hook('render:response', () => {})
    hooks.hook('render:before', () => {})
    expect(reported()).toEqual([])
  })
})
