import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stripAnsi } from 'consola/utils'
import {
  OptimizeDepsHintPlugin,
  formatDepLines,
  formatIncludeSnippet,
  optimizerCallbacks,
  userOptimizeDepsInclude,
} from '../src/plugins/optimize-deps-hint.ts'

vi.mock('@nuxt/kit', () => {
  return {
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  }
})

const { logger } = await import('@nuxt/kit')

function setupPlugin (opts: {
  userInclude?: string[]
  discovered?: Record<string, unknown>
} = {}) {
  const nuxt = { options: { rootDir: '/project' } } as any
  if (opts.userInclude?.length) {
    userOptimizeDepsInclude.set(nuxt, opts.userInclude)
  }
  const plugin = OptimizeDepsHintPlugin(nuxt) as any
  plugin.configureServer({ environments: { client: { depsOptimizer: { metadata: { optimized: {}, discovered: opts.discovered ?? {} } } } } })
  return { plugin, callbacks: optimizerCallbacks.get(nuxt)! }
}

async function flushHint () {
  vi.advanceTimersByTime(3000)
  await vi.advanceTimersByTimeAsync(0)
}

function infoCalls (text: string) {
  return vi.mocked(logger.info).mock.calls.map(c => stripAnsi(String(c[0]))).filter(c => c.includes(text))
}

describe('formatIncludeSnippet', () => {
  it('returns empty array for no deps', () => {
    expect(formatIncludeSnippet([])).toBe('[]')
  })

  it('sorts deps in expected order (scoped first, then alphabetical)', () => {
    const result = formatIncludeSnippet(['zod', 'b-pkg', '@vueuse/core', 'lodash', '@nuxt/kit', 'a-pkg'])
    const order = [...result.matchAll(/'([^']+)'/g)].map(m => m[1])
    expect(order).toEqual(['@nuxt/kit', '@vueuse/core', 'a-pkg', 'b-pkg', 'lodash', 'zod'])
  })
})

describe('formatDepLines', () => {
  it('groups multiple deps from same importer', () => {
    const importers = new Map([
      ['lodash', './app/index.vue'],
      ['underscore', './app/index.vue'],
    ])
    const result = stripAnsi(formatDepLines(['lodash', 'underscore'], importers))
    expect(result).toContain('./app/index.vue')
    expect(result).toContain('    lodash')
    expect(result).toContain('    underscore')
    expect(result).not.toContain('lodash ←')
  })

  it('lists ungrouped deps before grouped deps', () => {
    const importers = new Map([['lodash', './app/index.vue']])
    const result = stripAnsi(formatDepLines(['lodash', 'solo'], importers))
    expect(result).toBe('  solo\n  lodash ← ./app/index.vue')
  })
})

describe('OptimizeDepsHintPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.warn).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies only to the client environment, and without a deps optimizer', () => {
    const plugin = OptimizeDepsHintPlugin({ options: { rootDir: '/project' } } as any) as any
    expect(plugin.applyToEnvironment({ name: 'client' })).toBe(true)
    expect(plugin.applyToEnvironment({ name: 'ssr' })).toBe(false)
    expect(() => plugin.configureServer({ environments: {} })).not.toThrow()
  })

  it('shows bare imports with their importer', async () => {
    const { plugin, callbacks } = setupPlugin()

    plugin.resolveId.handler('lodash', '/project/app/pages/index.vue')
    callbacks.onNewDeps(['lodash'])

    await flushHint()
    expect(infoCalls('Vite discovered new dependencies at runtime')[0]).toContain('lodash ← ./app/pages/index.vue')
  })

  it('ignores deps already in userInclude', async () => {
    const { callbacks } = setupPlugin({ userInclude: ['known-dep'] })

    callbacks.onNewDeps(['known-dep'])

    await flushHint()
    expect(infoCalls('Vite discovered new dependencies at runtime')).toHaveLength(0)
  })

  it.each([
    ['across discoveries', [['dep-a'], ['dep-b']]],
    ['in a single discovery', [['dep-a', 'dep-b']]],
  ])('shows one hint for deps found %s', async (_, discoveries) => {
    const { callbacks } = setupPlugin()

    for (const deps of discoveries) {
      callbacks.onNewDeps(deps)
    }

    await flushHint()
    const calls = infoCalls('Vite discovered new dependencies at runtime')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('dep-a')
    expect(calls[0]).toContain('dep-b')
  })

  it('shows concise hint on subsequent discoveries', async () => {
    const { callbacks } = setupPlugin()

    callbacks.onNewDeps(['first'])
    await flushHint()

    vi.mocked(logger.info).mockClear()
    callbacks.onNewDeps(['second'])
    await flushHint()

    const [call] = infoCalls('New dependencies found')
    expect(call).toContain('second')
    expect(call).not.toContain('defineNuxtConfig')
    expect(call).not.toContain('Learn more')
  })

  it('combines new deps and unresolvable user and module deps into a single hint, once', async () => {
    const { callbacks } = setupPlugin({ userInclude: ['good', 'stale-dep'] })

    callbacks.onStaleDep('stale-dep')
    callbacks.onStaleDep('module-dep')
    callbacks.onNewDeps(['new-dep'])

    await flushHint()
    const calls = infoCalls('Vite discovered new dependencies at runtime')
    expect(calls).toHaveLength(1)
    expect(calls[0]!.match(/Unresolvable/g)).toHaveLength(1)
    expect(calls[0]).toContain('  stale-dep')
    expect(calls[0]).toContain('module-dep (from a Nuxt module)')
    expect(calls[0]!.match(/defineNuxtConfig/g)).toHaveLength(1)
    expect(calls[0]).toContain('\'good\',')
    expect(calls[0]).toContain('\'new-dep\',')
    expect(calls[0]).not.toContain('\'stale-dep\',')
    expect(logger.warn).not.toHaveBeenCalled()

    vi.mocked(logger.info).mockClear()
    callbacks.onNewDeps(['second'])
    await flushHint()
    expect(infoCalls('Unresolvable')).toHaveLength(0)
  })

  it('warns about stale optimized deps when there are no new deps', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { callbacks } = setupPlugin({ userInclude: ['stale'] })

    callbacks.onStaleDep('stale')
    callbacks.onStaleDep('mod-dep')
    await flushHint()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`stale`'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`mod-dep` (from a Nuxt module)'))
    expect(logger.warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('flags CJS deps from optimizer metadata in hint and config snippet', async () => {
    const { callbacks } = setupPlugin({
      discovered: { lodash: { needsInterop: true }, radash: { needsInterop: false } },
    })

    callbacks.onNewDeps(['lodash', 'radash'])

    await flushHint()
    const [call] = infoCalls('Vite discovered new dependencies at runtime')
    expect(call).toContain('lodash (CJS)')
    expect(call).not.toContain('radash (CJS)')
    expect(call).toContain('\'lodash\', // CJS')
    expect(call).not.toContain('\'radash\', // CJS')
  })
})
