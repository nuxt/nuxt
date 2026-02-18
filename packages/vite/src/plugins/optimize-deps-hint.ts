import { relative } from 'pathe'
import type { Plugin } from 'vite'
import type { Nuxt } from '@nuxt/schema'
import { logger } from '@nuxt/kit'
import { colorize } from 'consola/utils'

// Replaces Vite's default optimizer messages (suppressed in logger.ts):
//   info: "new dependencies optimized: X, Y"
//   warn: "Failed to resolve dependency: X, present in client 'optimizeDeps.include'"
//   warn: "Cannot optimize dependency: X, present in client 'optimizeDeps.include'"
//
// logger.ts parses these messages and forwards them via onNewDeps/onStaleDep callbacks.

export function formatIncludeSnippet (deps: string[], cjsDeps?: Set<string>): string {
  if (!deps.length) { return '[]' }
  const lines = deps.map((d) => {
    const comment = cjsDeps?.has(d) ? ' // CJS' : ''
    return `        '${d}',${comment}`
  })
  return `[\n${lines.join('\n')}\n      ]`
}

function configBlock (deps: string[], cjsDeps?: Set<string>): string {
  return (
    colorize('gray', `export default defineNuxtConfig({\n  vite: {\n    optimizeDeps: {\n      include: ${formatIncludeSnippet(deps, cjsDeps)}\n    }\n  }\n})\n\n`) +
    `Learn more: https://vite.dev/guide/dep-pre-bundling.html`
  )
}

// Group deps by importer file, with ungrouped deps listed first
export function formatDepLines (deps: string[], importers?: Map<string, string>, cjsDeps?: Set<string>): string {
  const ungrouped: string[] = []
  const grouped = new Map<string, string[]>()

  for (const d of deps) {
    const importer = importers?.get(d)
    const label = colorize('cyan', d) + (cjsDeps?.has(d) ? ' ' + colorize('yellow', '(CJS)') : '')
    if (importer) {
      const list = grouped.get(importer) || []
      list.push(label)
      grouped.set(importer, list)
    } else {
      ungrouped.push(`  ${label}`)
    }
  }

  const lines = [...ungrouped]
  for (const [file, labels] of grouped) {
    if (labels.length === 1) {
      lines.push(`  ${labels[0]} ${colorize('gray', `← ${file}`)}`)
    } else {
      lines.push(`  ${colorize('gray', file)}`)
      for (const label of labels) {
        lines.push(`    ${label}`)
      }
    }
  }
  return lines.join('\n')
}

export function formatNewDepsHint (newDeps: string[], allDeps: string[], importers?: Map<string, string>, cjsDeps?: Set<string>): string {
  return (
    `Vite discovered new dependencies at runtime:\n` +
    formatDepLines(newDeps, importers, cjsDeps) + '\n' +
    `Pre-bundle them in your \`nuxt.config.ts\` to avoid page reloads:\n\n` +
    configBlock(allDeps, cjsDeps)
  )
}

export function formatStaleDepsHint (userStale: string[], moduleStale: string[]): string {
  const lines: string[] = []
  for (const d of userStale) { lines.push(`  ${colorize('cyan', d)}`) }
  for (const d of moduleStale) { lines.push(`  ${colorize('cyan', d)} ${colorize('gray', '(from a Nuxt module)')}`) }
  return `Unresolvable \`optimizeDeps.include\` entries:\n${lines.join('\n')}`
}

// Snapshotted in bundle() before vite:extend can mutate shared array references
export const userOptimizeDepsInclude = new WeakMap<Nuxt, string[]>()

// Callbacks for createViteLogger to forward parsed optimizer messages
export const optimizerCallbacks = new WeakMap<Nuxt, {
  onNewDeps: (deps: string[]) => void
  onStaleDep: (dep: string) => void
}>()

// --- Plugin ---

export function OptimizeDepsHintPlugin (nuxt: Nuxt): Plugin {
  const rootDir = nuxt.options.rootDir
  // Read lazily — snapshot is set after plugin instantiation in the env API path
  const getUserInclude = () => userOptimizeDepsInclude.get(nuxt) || []
  const discovered = new Set<string>()
  const userStale = new Set<string>()
  const moduleStale = new Set<string>()
  let pending = new Set<string>()
  let hintTimer: ReturnType<typeof setTimeout> | null = null
  let hasShownStaleHint = false
  let hasShownFullHint = false

  /** User includes (minus stale) + discovered, for the config snippet */
  const getSnippetDeps = () => [...new Set([...getUserInclude().filter(d => !userStale.has(d)), ...discovered])]

  let getCjsDeps: () => Set<string> = () => new Set()

  const importerOf = new Map<string, string>()

  // Merged hint: new deps + stale warnings + single config snippet
  function scheduleHint () {
    if (hintTimer) { clearTimeout(hintTimer) }
    hintTimer = setTimeout(() => {
      const hasNew = pending.size > 0
      const hasStale = !hasShownStaleHint && (userStale.size > 0 || moduleStale.size > 0)

      if (hasNew) {
        const newDeps = [...pending]
        pending = new Set()
        const cjsDeps = getCjsDeps()

        // Resolve relative paths only for deps being displayed
        const relativeImporters = new Map<string, string>()
        for (const dep of newDeps) {
          const imp = importerOf.get(dep)
          if (imp) { relativeImporters.set(dep, './' + relative(rootDir, imp)) }
          importerOf.delete(dep)
        }

        if (hasShownFullHint) {
          // Concise repeat: just the dep names
          const depList = newDeps.map(d => colorize('cyan', d) + (cjsDeps.has(d) ? ' ' + colorize('yellow', '(CJS)') : '')).join(', ')
          logger.info(`New dependencies found: ${depList}`)
        } else {
          hasShownFullHint = true
          const snippetDeps = getSnippetDeps()

          const parts: string[] = []
          parts.push(`Vite discovered new dependencies at runtime:\n${formatDepLines(newDeps, relativeImporters, cjsDeps)}`)

          if (hasStale) {
            hasShownStaleHint = true
            parts.push(formatStaleDepsHint([...userStale], [...moduleStale]))
          }

          parts.push(
            `Pre-bundle them in your \`nuxt.config.ts\` to avoid page reloads:\n\n` +
            configBlock(snippetDeps, cjsDeps),
          )

          logger.info(parts.join('\n\n'))
        }
      } else if (hasStale) {
        hasShownStaleHint = true
        const parts: string[] = []
        parts.push(formatStaleDepsHint([...userStale], [...moduleStale]))
        parts.push(
          `Update your \`nuxt.config.ts\`:\n\n` +
          configBlock(getSnippetDeps()),
        )
        logger.warn(parts.join('\n\n'))
      }
    }, 3000)
  }

  // Register callbacks for logger.ts to forward parsed Vite optimizer messages
  optimizerCallbacks.set(nuxt, {
    onNewDeps (deps: string[]) {
      for (const dep of deps) {
        if (getUserInclude().includes(dep)) { continue }
        discovered.add(dep)
        pending.add(dep)
      }
      if (pending.size > 0) { scheduleHint() }
    },
    onStaleDep (dep: string) {
      if (getUserInclude().includes(dep)) {
        userStale.add(dep)
      } else {
        moduleStale.add(dep)
      }
      scheduleHint()
    },
  })

  return {
    name: 'nuxt:optimize-deps-hint',
    apply: 'serve',
    applyToEnvironment: environment => environment.name === 'client',

    // Track bare-import → importer so we know what triggered a dep discovery
    resolveId: {
      order: 'pre',
      handler (source: string, importer: string | undefined) {
        if (importer && !importer.includes('/node_modules/') && !source.startsWith('.') && !source.startsWith('/') && !source.startsWith('\0')) {
          importerOf.set(source, importer)
        }
      },
    },

    // Read optimizer metadata for CJS detection
    configureServer (server) {
      const optimizer = server.environments.client?.depsOptimizer
      if (!optimizer) { return }

      getCjsDeps = () => {
        const cjs = new Set<string>()
        for (const [id, info] of Object.entries({ ...optimizer.metadata.optimized, ...optimizer.metadata.discovered })) {
          if (info.needsInterop) { cjs.add(id) }
        }
        return cjs
      }
    },
  }
}
