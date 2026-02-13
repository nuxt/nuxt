import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stripAnsi } from 'consola/utils'
import {
  OptimizeDepsHintPlugin,
  formatDepLines,
  formatIncludeSnippet,
  formatNewDepsHint,
  formatStaleDepsHint,
  optimizerCallbacks,
  userOptimizeDepsInclude,
} from '../src/plugins/optimize-deps-hint.ts'

vi.mock('@nuxt/kit', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const { logger } = await import('@nuxt/kit')

// --- Helpers ---

function createNuxt (userInclude: string[] = []) {
  const nuxt = { options: { rootDir: '/project' } } as any
  if (userInclude.length) {
    userOptimizeDepsInclude.set(nuxt, userInclude)
  }
  return nuxt
}

function createOptimizer (optimized: Record<string, unknown> = {}, discovered: Record<string, unknown> = {}) {
  return {
    metadata: { optimized, discovered },
  }
}

function createServer (optimizer: ReturnType<typeof createOptimizer>) {
  return { environments: { client: { depsOptimizer: optimizer } } } as any
}

function setupPlugin (opts: {
  userInclude?: string[]
  optimized?: Record<string, unknown>
  discovered?: Record<string, unknown>
} = {}) {
  const nuxt = createNuxt(opts.userInclude)
  const plugin = OptimizeDepsHintPlugin(nuxt) as any
  const callbacks = optimizerCallbacks.get(nuxt)!
  const optimizer = createOptimizer(opts.optimized, opts.discovered)

  plugin.configureServer(createServer(optimizer))

  return { plugin, callbacks, optimizer, nuxt }
}

async function flushHint () {
  vi.advanceTimersByTime(3000)
  await vi.advanceTimersByTimeAsync(0)
}

// --- Formatter tests ---

describe('formatIncludeSnippet', () => {
  it('returns empty array for no deps', () => {
    expect(formatIncludeSnippet([])).toBe('[]')
  })

  it('formats deps as indented list', () => {
    const result = formatIncludeSnippet(['vue', 'pinia'])
    expect(result).toContain('\'vue\',')
    expect(result).toContain('\'pinia\',')
  })

  it('adds // CJS comment for CJS deps', () => {
    const cjs = new Set(['lodash'])
    const result = formatIncludeSnippet(['lodash', 'radash'], cjs)
    expect(result).toContain('\'lodash\', // CJS')
    expect(result).not.toContain('\'radash\', // CJS')
  })
})

describe('formatDepLines', () => {
  it('lists deps without importers', () => {
    const result = stripAnsi(formatDepLines(['a', 'b']))
    expect(result).toContain('  a')
    expect(result).toContain('  b')
  })

  it('shows single dep with importer inline', () => {
    const importers = new Map([['lodash', './app/index.vue']])
    const result = stripAnsi(formatDepLines(['lodash'], importers))
    expect(result).toContain('lodash ← ./app/index.vue')
  })

  it('groups multiple deps from same importer', () => {
    const importers = new Map([
      ['lodash', './app/index.vue'],
      ['underscore', './app/index.vue'],
    ])
    const result = stripAnsi(formatDepLines(['lodash', 'underscore'], importers))
    expect(result).toContain('./app/index.vue')
    expect(result).toContain('    lodash')
    expect(result).toContain('    underscore')
    // should NOT have inline arrows when grouped
    expect(result).not.toContain('lodash ←')
  })

  it('mixes ungrouped and grouped deps', () => {
    const importers = new Map([['lodash', './app/index.vue']])
    const result = stripAnsi(formatDepLines(['solo', 'lodash'], importers))
    // ungrouped first
    expect(result.indexOf('solo')).toBeLessThan(result.indexOf('lodash'))
  })

  it('adds CJS tag to deps', () => {
    const cjs = new Set(['lodash'])
    const result = stripAnsi(formatDepLines(['lodash', 'radash'], undefined, cjs))
    expect(result).toContain('lodash (CJS)')
    expect(result).not.toContain('radash (CJS)')
  })
})

describe('formatNewDepsHint', () => {
  it('lists new deps and shows full config snippet', () => {
    const hint = formatNewDepsHint(['dep1', 'dep2'], ['existing', 'dep1', 'dep2'])
    const plain = stripAnsi(hint)

    expect(plain).toContain('Vite discovered new dependencies at runtime:')
    expect(plain).toContain('dep1')
    expect(plain).toContain('dep2')
    expect(plain).toContain('\'existing\',')
    expect(plain).toContain('\'dep1\',')
    expect(plain).toContain('\'dep2\',')
    expect(plain).toContain('Learn more:')
  })

  it('shows importer path when available', () => {
    const importers = new Map([['lodash', './app/pages/index.vue']])
    const hint = formatNewDepsHint(['lodash'], ['lodash'], importers)
    const plain = stripAnsi(hint)

    expect(plain).toContain('lodash')
    expect(plain).toContain('← ./app/pages/index.vue')
  })

  it('shows CJS tag in dep list and // CJS in config snippet', () => {
    const cjs = new Set(['lodash'])
    const hint = formatNewDepsHint(['lodash', 'radash'], ['lodash', 'radash'], undefined, cjs)
    const plain = stripAnsi(hint)

    expect(plain).toContain('lodash (CJS)')
    expect(plain).not.toContain('radash (CJS)')
    expect(plain).toContain('\'lodash\', // CJS')
    expect(plain).not.toContain('\'radash\', // CJS')
  })

  it('shows pre-bundle prompt in update line', () => {
    const hint = formatNewDepsHint(['radash'], ['radash'])
    const plain = stripAnsi(hint)
    expect(plain).toContain('Pre-bundle them in your `nuxt.config.ts` to avoid page reloads:')
  })
})

describe('formatStaleDepsHint', () => {
  it('lists user stale deps', () => {
    const plain = stripAnsi(formatStaleDepsHint(['stale-dep'], []))
    expect(plain).toContain('Unresolvable')
    expect(plain).toContain('stale-dep')
  })

  it('annotates module stale deps', () => {
    const plain = stripAnsi(formatStaleDepsHint([], ['mod-dep']))
    expect(plain).toContain('mod-dep')
    expect(plain).toContain('(from a Nuxt module)')
  })

  it('combines both in one block', () => {
    const plain = stripAnsi(formatStaleDepsHint(['user-dep'], ['mod-dep']))
    expect(plain).toContain('user-dep')
    expect(plain).toContain('mod-dep (from a Nuxt module)')
    expect(plain.match(/Unresolvable/g)).toHaveLength(1)
  })
})

// --- Plugin tests ---

describe('OptimizeDepsHintPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(logger.info).mockClear()
    vi.mocked(logger.warn).mockClear()
    vi.mocked(logger.debug).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has correct plugin metadata', () => {
    const plugin = OptimizeDepsHintPlugin(createNuxt()) as any
    expect(plugin.name).toBe('nuxt:optimize-deps-hint')
    expect(plugin.apply).toBe('serve')
  })

  it('applies only to client environment', () => {
    const plugin = OptimizeDepsHintPlugin(createNuxt()) as any
    expect(plugin.applyToEnvironment({ name: 'client' })).toBe(true)
    expect(plugin.applyToEnvironment({ name: 'server' })).toBe(false)
    expect(plugin.applyToEnvironment({ name: 'ssr' })).toBe(false)
  })

  it('early returns when no optimizer', () => {
    const plugin = OptimizeDepsHintPlugin(createNuxt()) as any
    plugin.configureServer({ environments: { client: {} } })
    plugin.configureServer({ environments: {} })
  })

  describe('resolveId', () => {
    it('tracks bare imports with their importer', async () => {
      const { plugin, callbacks } = setupPlugin()

      plugin.resolveId.handler('lodash', '/project/app/pages/index.vue')
      callbacks.onNewDeps(['lodash'])

      await flushHint()
      const call = vi.mocked(logger.info).mock.calls
        .map(c => stripAnsi(String(c[0])))
        .find(c => c.includes('Vite discovered new dependencies at runtime'))
      expect(call).toContain('← ./app/pages/index.vue')
    })

    it('ignores relative imports', () => {
      const { plugin } = setupPlugin()
      plugin.resolveId.handler('./foo', '/project/bar.ts')
    })

    it('ignores virtual modules', () => {
      const { plugin } = setupPlugin()
      plugin.resolveId.handler('\0virtual:mod', '/project/bar.ts')
    })
  })

  describe('onNewDeps', () => {
    it('tracks new deps and shows hint', async () => {
      const { callbacks } = setupPlugin()

      callbacks.onNewDeps(['new-dep'])

      await flushHint()
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('new-dep'))
    })

    it('ignores deps already in userInclude', async () => {
      const { callbacks } = setupPlugin({ userInclude: ['known-dep'] })

      callbacks.onNewDeps(['known-dep'])

      await flushHint()
      const calls = vi.mocked(logger.info).mock.calls.map(c => String(c[0]))
      expect(calls.every(c => !c.includes('Vite discovered new dependencies at runtime'))).toBe(true)
    })

    it('debounces multiple discoveries into one hint', async () => {
      const { callbacks } = setupPlugin()

      callbacks.onNewDeps(['dep-a'])
      callbacks.onNewDeps(['dep-b'])

      await flushHint()
      const newDepCalls = vi.mocked(logger.info).mock.calls
        .map(c => String(c[0]))
        .filter(c => c.includes('Vite discovered new dependencies at runtime'))
      expect(newDepCalls).toHaveLength(1)
      expect(newDepCalls[0]).toContain('dep-a')
      expect(newDepCalls[0]).toContain('dep-b')
    })

    it('batches multiple deps in a single callback', async () => {
      const { callbacks } = setupPlugin()

      callbacks.onNewDeps(['dep-a', 'dep-b'])

      await flushHint()
      const newDepCalls = vi.mocked(logger.info).mock.calls
        .map(c => String(c[0]))
        .filter(c => c.includes('Vite discovered new dependencies at runtime'))
      expect(newDepCalls).toHaveLength(1)
      expect(newDepCalls[0]).toContain('dep-a')
      expect(newDepCalls[0]).toContain('dep-b')
    })

    it('shows concise hint on subsequent discoveries', async () => {
      const { callbacks } = setupPlugin()

      callbacks.onNewDeps(['first'])
      await flushHint()

      vi.mocked(logger.info).mockClear()
      callbacks.onNewDeps(['second'])
      await flushHint()

      const call = vi.mocked(logger.info).mock.calls
        .map(c => stripAnsi(String(c[0])))
        .find(c => c.includes('New dependencies found'))
      expect(call).toContain('second')
      // No config block or learn more
      expect(call).not.toContain('defineNuxtConfig')
      expect(call).not.toContain('Learn more')
    })
  })

  describe('onStaleDep', () => {
    it('classifies user deps as userStale', async () => {
      const { callbacks } = setupPlugin({ userInclude: ['stale-user-dep'] })

      callbacks.onNewDeps(['trigger'])
      callbacks.onStaleDep('stale-user-dep')
      await flushHint()
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Unresolvable'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('stale-user-dep'))
    })

    it('classifies non-user deps as moduleStale', async () => {
      const { callbacks } = setupPlugin({ userInclude: [] })

      callbacks.onNewDeps(['trigger'])
      callbacks.onStaleDep('module-dep')
      await flushHint()
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('(from a Nuxt module)'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('module-dep'))
    })

    it('shows stale-only hint via logger.warn when no new deps', async () => {
      const { callbacks } = setupPlugin({ userInclude: ['stale'] })

      callbacks.onStaleDep('stale')
      await flushHint()
      expect(logger.warn).toHaveBeenCalledTimes(1)
      const warnMsg = stripAnsi(String(vi.mocked(logger.warn).mock.calls[0]![0]))
      expect(warnMsg).toContain('Unresolvable')
      expect(warnMsg).toContain('defineNuxtConfig')
    })

    it('shows stale hint only once', async () => {
      const { callbacks } = setupPlugin({ userInclude: ['stale'] })

      callbacks.onStaleDep('stale')
      callbacks.onNewDeps(['first'])
      await flushHint()

      // Second discovery — stale should not repeat
      vi.mocked(logger.info).mockClear()
      callbacks.onNewDeps(['second'])
      await flushHint()
      const calls = vi.mocked(logger.info).mock.calls
        .map(c => stripAnsi(String(c[0])))
        .filter(c => c.includes('Unresolvable'))
      expect(calls).toHaveLength(0)
    })
  })

  describe('merged hint', () => {
    it('combines new deps + stale warnings into single logger.info call', async () => {
      const { callbacks } = setupPlugin({ userInclude: ['stale-dep'] })

      callbacks.onStaleDep('stale-dep')
      callbacks.onNewDeps(['new-dep'])

      await flushHint()
      // Should be one info call with both new deps and stale warning
      const infoCalls = vi.mocked(logger.info).mock.calls
        .map(c => stripAnsi(String(c[0])))
        .filter(c => c.includes('Vite discovered new dependencies at runtime'))
      expect(infoCalls).toHaveLength(1)
      expect(infoCalls[0]).toContain('new-dep')
      expect(infoCalls[0]).toContain('Unresolvable')
      expect(infoCalls[0]).toContain('stale-dep')
      // Only one config block
      expect(infoCalls[0]!.match(/defineNuxtConfig/g)).toHaveLength(1)
      // No separate warn call
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })

  describe('getSnippetDeps', () => {
    it('excludes stale user deps and includes discovered in config snippet', async () => {
      const { callbacks } = setupPlugin({ userInclude: ['good', 'stale'] })

      callbacks.onStaleDep('stale')
      callbacks.onNewDeps(['found'])

      await flushHint()
      const newDepsCall = vi.mocked(logger.info).mock.calls
        .map(c => stripAnsi(String(c[0])))
        .find(c => c.includes('Vite discovered new dependencies at runtime'))
      expect(newDepsCall).toContain('\'good\',')
      expect(newDepsCall).toContain('\'found\',')
      expect(newDepsCall).not.toContain('\'stale\',')
    })
  })

  describe('CJS detection', () => {
    it('flags CJS deps from optimizer metadata in hint and config snippet', async () => {
      const { callbacks } = setupPlugin({
        discovered: { lodash: { needsInterop: true }, radash: { needsInterop: false } },
      })

      callbacks.onNewDeps(['lodash', 'radash'])

      await flushHint()
      const call = vi.mocked(logger.info).mock.calls
        .map(c => stripAnsi(String(c[0])))
        .find(c => c.includes('Vite discovered new dependencies at runtime'))

      expect(call).toContain('lodash (CJS)')
      expect(call).not.toContain('radash (CJS)')
      expect(call).toContain('\'lodash\', // CJS')
      expect(call).not.toContain('\'radash\', // CJS')
    })
  })
})
