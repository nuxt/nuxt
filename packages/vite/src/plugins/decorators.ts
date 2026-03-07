import process from 'node:process'
import type { Plugin } from 'vite'
import { addDependency } from 'nypm'
import { logger } from '@nuxt/kit'
import { hasTTY, isCI } from 'std-env'
import type { Nuxt } from '@nuxt/schema'

const BABEL_DECORATOR_DEPS = ['@babel/plugin-proposal-decorators'] as const

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
          for (const dep of BABEL_DECORATOR_DEPS) {
            await addDependency(dep, {
              dev: true,
              cwd: nuxt.options.rootDir,
              silent: true,
            })
          }
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

export async function DecoratorsPlugin (nuxt: Nuxt): Promise<Plugin | undefined> {
  if (!nuxt.options.experimental.decorators) {
    return
  }

  if (!await ensureBabelDecoratorDeps(nuxt)) {
    return
  }

  const { transformSync } = await import('@babel/core')

  return {
    name: 'nuxt:decorators',
    transform: {
      filter: {
        // Only run on files containing @ (a prerequisite for decorator syntax)
        code: '@',
        // Exclude Vue style/template blocks and macro virtual modules
        id: {
          exclude: [
            /\.vue\?.*\btype=(?:style|template)\b/,
            /\.vue\?.*\bmacro=true\b/,
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
