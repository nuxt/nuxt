import process from 'node:process'
import type * as vite from 'vite'
import { createLogger } from 'vite'
import { logger } from '@nuxt/kit'
import { colorize, stripAnsi } from 'consola/utils'
import { hasTTY, isCI } from 'std-env'
import type { NuxtOptions } from '@nuxt/schema'
import { relative } from 'pathe'
import { useResolveFromPublicAssets } from '../plugins/public-dirs.ts'

let duplicateCount = 0
let lastType: vite.LogType | null = null
let lastMsg: string | null = null

export const logLevelMap: Record<NuxtOptions['logLevel'], vite.UserConfig['logLevel']> = {
  silent: 'silent',
  info: 'info',
  verbose: 'info',
}

const logLevelMapReverse: Record<NonNullable<vite.UserConfig['logLevel']>, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
}

const RUNTIME_RESOLVE_REF_RE = /^([^ ]+) referenced in/m
export function createViteLogger (config: vite.InlineConfig, ctx: { hideOutput?: boolean } = {}): vite.Logger {
  const pendingOptimizeDeps = new Set<string>()
  let optimizeDepsHintTimer: NodeJS.Timeout | null = null
  let hasShownOptimizeDepsHint = false

  const loggedErrors = new WeakSet<any>()
  const canClearScreen = hasTTY && !isCI && config.clearScreen
  const _logger = createLogger()
  const relativeOutDir = relative(config.root!, config.build!.outDir || '')
  const clear = () => {
    _logger.clearScreen(
      // @ts-expect-error silent is a log level but not a valid option for clearScreens
      'silent',
    )
  }
  const clearScreen = canClearScreen ? clear : () => {}

  const { resolveFromPublicAssets } = useResolveFromPublicAssets()

  function output (type: vite.LogType, msg: string, options: vite.LogErrorOptions = {}) {
    if (typeof msg === 'string' && !process.env.DEBUG) {
      // TODO: resolve upstream in Vite
      // Hide sourcemap warnings related to node_modules
      if (msg.startsWith('Sourcemap') && msg.includes('node_modules')) { return }
      // Hide warnings about externals produced by https://github.com/vitejs/vite/blob/v5.2.11/packages/vite/src/node/plugins/css.ts#L350-L355
      if (msg.includes('didn\'t resolve at build time, it will remain unchanged to be resolved at runtime')) {
        const id = msg.trim().match(RUNTIME_RESOLVE_REF_RE)?.[1]
        if (id && resolveFromPublicAssets(id)) { return }
      }
      if (type === 'info' && ctx.hideOutput && msg.includes(relativeOutDir)) { return }

      if (type === 'info' && !hasShownOptimizeDepsHint && (msg.includes('new dependencies optimized:') || msg.includes('optimized dependencies changed. reloading'))) {
        if (msg.includes('new dependencies optimized:')) {
          const deps = msg.split('new dependencies optimized:')[1]!
            .split(',')
            .map(d => stripAnsi(d.trim()))
            .filter(Boolean)

          const include = (config.optimizeDeps?.include as string[] | undefined) || []
          for (const dep of deps) {
            if (!include.includes(dep)) {
              pendingOptimizeDeps.add(dep)
            }
          }
        }

        if (optimizeDepsHintTimer) { clearTimeout(optimizeDepsHintTimer) }
        optimizeDepsHintTimer = setTimeout(() => {
          optimizeDepsHintTimer = null
          if (pendingOptimizeDeps.size > 0) {
            hasShownOptimizeDepsHint = true
            const existingDeps = (config.optimizeDeps?.include as string[] | undefined) || []
            const allDeps = [...existingDeps, ...pendingOptimizeDeps]
            const depsList = allDeps.map(d => `        '${d}',`).join('\n')
            logger.info(
              `Hint: Vite has discovered new dependencies that were not pre-bundled or cached at startup.\n` +
              `This has caused the page to reload. To prevent this and speed up your startup,\n` +
              `you can add them to your \`nuxt.config.ts\` so they are bundled and cached on the first run:\n\n` +
              colorize('gray', `export default defineNuxtConfig({\n  vite: {\n    optimizeDeps: {\n      include: [\n${depsList}\n      ]\n    }\n  }\n})\n\n`) +
              `Learn more: https://vite.dev/guide/dep-pre-bundling.html`,
            )
            pendingOptimizeDeps.clear()
          }
        }, 2500)
      }
    }

    const sameAsLast = lastType === type && lastMsg === msg
    if (sameAsLast) {
      duplicateCount += 1
      clearScreen()
    } else {
      duplicateCount = 0
      lastType = type
      lastMsg = msg

      if (options.clear) {
        clearScreen()
      }
    }

    if (options.error) {
      loggedErrors.add(options.error)
    }

    const prevLevel = logger.level
    logger.level = logLevelMapReverse[config.logLevel || 'info']
    logger[type](msg + (sameAsLast ? colorize('dim', ` (x${duplicateCount + 1})`) : ''))
    logger.level = prevLevel
  }

  const warnedMessages = new Set<string>()

  const viteLogger: vite.Logger = {
    hasWarned: false,
    info (msg, opts) {
      output('info', msg, opts)
    },
    warn (msg, opts) {
      viteLogger.hasWarned = true
      output('warn', msg, opts)
    },
    warnOnce (msg, opts) {
      if (warnedMessages.has(msg)) { return }
      viteLogger.hasWarned = true
      output('warn', msg, opts)
      warnedMessages.add(msg)
    },
    error (msg, opts) {
      viteLogger.hasWarned = true
      output('error', msg, opts)
    },
    clearScreen (_type) {
      pendingOptimizeDeps.clear()
      if (optimizeDepsHintTimer) { clearTimeout(optimizeDepsHintTimer) }
      optimizeDepsHintTimer = null
      hasShownOptimizeDepsHint = false
      clear()
    },
    hasErrorLogged (error) {
      return loggedErrors.has(error)
    },
  }

  return viteLogger
}
