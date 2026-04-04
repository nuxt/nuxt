import type { Plugin } from 'vite'
import { ensureDependencyInstalled, logger } from '@nuxt/kit'
import type { Nuxt } from '@nuxt/schema'

const BABEL_DECORATOR_DEPS = ['@babel/plugin-proposal-decorators', '@babel/plugin-syntax-jsx'] as const

export function DecoratorsPlugin (nuxt: Nuxt): Plugin {
  let transformSync: typeof import('@babel/core').transformSync

  return {
    name: 'nuxt:decorators',
    apply: () => !!nuxt.options.experimental.decorators,
    async applyToEnvironment () {
      const result = await ensureDependencyInstalled([...BABEL_DECORATOR_DEPS], {
        rootDir: nuxt.options.rootDir,
        searchPaths: nuxt.options.modulesDir,
        from: import.meta.url,
      })

      if (result !== true) {
        logger.warn(`Install ${result.map(d => `\`${d}\``).join(' and ')} to enable decorator support.`)
        return false
      }

      transformSync = await import('@babel/core').then(r => r.transformSync)
      return true
    },
    transform: {
      filter: {
        // Only run on files that may contain decorator syntax
        // (JS/TS/Vue files) and that include "@" as a quick check
        code: '@',

        id: {
          // Restrict transform to JavaScript/TypeScript and Vue files only
          include: [/\.(ts|js|tsx|jsx|vue)$/],

          // Explicitly exclude non-JS assets and Vue sub-blocks
          // (e.g. <style> or <template> in SFCs)
          exclude: [
            /\.css$/,
            /\.scss$/,
            /\.sass$/,
            /\.less$/,
            /\.styl$/,
            /\.vue\?.*\btype=(?:style|template)\b/,
          ],
        },
      },
      handler (code, id) {
        // Skip uncompiled SFC markup (raw .vue files not yet processed by @vitejs/plugin-vue)
        if (id.includes('.vue') && code.trimStart().startsWith('<')) {
          return
        }

        const result = transformSync(code, {
          filename: id,
          configFile: false,
          plugins: [
            '@babel/plugin-syntax-jsx',
            ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
          ],
          sourceMaps: true,
        })

        if (result?.code != null) {
          return {
            code: result.code,
            map: result.map,
          }
        }
      },
    },
  }
}
