import process from 'node:process'
import type { Plugin } from 'vite'
import { addDependency } from 'nypm'
import { logger } from '@nuxt/kit'
import { hasTTY, isCI } from 'std-env'
import type { Nuxt } from '@nuxt/schema'
import jsTokens from 'js-tokens'

const BABEL_DECORATOR_DEPS = ['@babel/plugin-proposal-decorators', '@babel/plugin-syntax-jsx']

async function ensureBabelDecoratorDeps (nuxt: Nuxt): Promise<boolean> {
  for (const pkg of BABEL_DECORATOR_DEPS) {
    try {
      await import(pkg)
    } catch (_err) {
      const err = _err as NodeJS.ErrnoException

      if (err.code !== 'ERR_MODULE_NOT_FOUND' && err.code !== 'MODULE_NOT_FOUND') {
        throw err
      }

      if (!isCI && hasTTY) {
        logger.info('Decorator support requires additional dependencies.')
        const shouldInstall = await logger.prompt(`Install \`${BABEL_DECORATOR_DEPS.join('` and `')}\`?`, {
          type: 'confirm',
          initial: true,
        })

        if (shouldInstall) {
          logger.start(`Installing ${BABEL_DECORATOR_DEPS.map(d => `\`${d}\``).join(' and ')}...`)
          await addDependency(BABEL_DECORATOR_DEPS, {
            dev: true,
            cwd: nuxt.options.rootDir,
            silent: true,
          })
          logger.info('Rerun Nuxt to enable decorator support.')
          process.exit(1)
        }
      }

      logger.warn(`Cannot find \`${pkg}\`. Install \`${BABEL_DECORATOR_DEPS.join('` and `')}\` to enable decorator support.`)
      return false
    }
  }
  return true
}

export function hasDecoratorSyntax (code: string, jsx = false) {
  const tokens = jsx ? jsTokens(code, { jsx: true }) : jsTokens(code)

  for (const token of tokens) {
    if (!token.value.includes('@')) {
      continue
    }

    switch (token.type) {
      case 'HashbangComment':
      case 'SingleLineComment':
      case 'TemplateHead':
      case 'TemplateMiddle':
        continue
      case 'MultiLineComment':
      case 'StringLiteral':
      case 'NoSubstitutionTemplate':
      case 'TemplateTail':
      case 'JSXString':
        // An unclosed token can consume code that follows it. Let Babel parse
        // ambiguous input instead of potentially hiding a real decorator.
        if (token.closed) {
          continue
        }
    }

    return true
  }

  return false
}

export function DecoratorsPlugin (nuxt: Nuxt): Plugin {
  let transformSync: typeof import('@babel/core').transformSync

  return {
    name: 'nuxt:decorators',
    apply: () => !!nuxt.options.experimental.decorators,
    async applyToEnvironment () {
      if (!await ensureBabelDecoratorDeps(nuxt)) {
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

        if (!hasDecoratorSyntax(code, /\.[jt]sx(?:$|\?)/.test(id))) {
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
