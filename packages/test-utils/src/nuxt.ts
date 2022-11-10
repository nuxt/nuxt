import { existsSync, promises as fsp } from 'node:fs'
import { resolve } from 'node:path'
import * as _kit from '@nuxt/kit'
import { useTestContext } from './context'

// @ts-ignore type cast
const kit: typeof _kit = _kit.default || _kit

const isNuxtApp = (dir: string) => {
  return existsSync(dir) && (
    existsSync(resolve(dir, 'pages')) ||
    existsSync(resolve(dir, 'nuxt.config.js')) ||
    existsSync(resolve(dir, 'nuxt.config.mjs')) ||
    existsSync(resolve(dir, 'nuxt.config.cjs')) ||
    existsSync(resolve(dir, 'nuxt.config.ts'))
  )
}

const resolveRootDir = () => {
  const { options } = useTestContext()

  const dirs = [
    options.rootDir,
    resolve(options.testDir, options.fixture),
    process.cwd()
  ]

  for (const dir of dirs) {
    if (dir && isNuxtApp(dir)) {
      return dir
    }
  }

  throw new Error('Invalid nuxt app. (Please explicitly set `options.rootDir` pointing to a valid nuxt app)')
}

export async function loadFixture () {
  const ctx = useTestContext()

  ctx.options.rootDir = resolveRootDir()

  if (!ctx.options.dev) {
    const randomId = Math.random().toString(36).slice(2, 8)
    const buildDir = resolve(ctx.options.rootDir, '.nuxt', randomId)
    Object.assign(ctx.options.nuxtConfig, {
      buildDir,
      nitro: {
        output: {
          dir: resolve(buildDir, 'output')
        }
      }
    })
  }

  ctx.nuxt = await kit.loadNuxt({
    cwd: ctx.options.rootDir,
    dev: ctx.options.dev,
    overrides: ctx.options.nuxtConfig,
    configFile: ctx.options.configFile
  })

  kit.logger.level = ctx.options.logLevel

  await fsp.mkdir(ctx.nuxt.options.buildDir, { recursive: true })
}

export async function buildFixture () {
  const ctx = useTestContext()
  await kit.buildNuxt(ctx.nuxt!)
}
