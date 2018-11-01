import path from 'path'
import fsExtra from 'fs-extra'
import consola from 'consola'
import esm from 'esm'

const _require = esm(module, {
  cache: false,
  cjs: {
    cache: true,
    vars: true,
    namedExports: true
  }
})

const getRootDir = argv => path.resolve(argv._[0] || '.')
const getNuxtConfigFile = argv => path.resolve(getRootDir(argv), argv['config-file'])

export async function getLockPath(lockPath) {
  if (lockPath) {
    if (!fsExtra.existsSync(lockPath)) {
      await fsExtra.mkdirp(lockPath)
    }

    return path.resolve(lockPath)
  } else {
    return path.resolve(process.cwd(), '.nuxt')
  }
}

export const defaultLockOptions = {
  autoUnlock: true,
  stale: 30000,
  onCompromised: err => consola.fatal(err)
}

export async function loadNuxtConfig(argv) {
  const rootDir = getRootDir(argv)
  const nuxtConfigFile = getNuxtConfigFile(argv)

  let options = {}

  if (fsExtra.existsSync(nuxtConfigFile)) {
    delete require.cache[nuxtConfigFile]
    options = _require(nuxtConfigFile) || {}
    if (options.default) {
      options = options.default
    }

    if (typeof options === 'function') {
      try {
        options = await options()
        if (options.default) {
          options = options.default
        }
      } catch (error) {
        consola.error(error)
        consola.fatal('Error while fetching async configuration')
      }
    }
  } else if (argv['config-file'] !== 'nuxt.config.js') {
    consola.fatal('Could not load config file: ' + argv['config-file'])
  }
  if (typeof options.rootDir !== 'string') {
    options.rootDir = rootDir
  }

  // Nuxt Mode
  options.mode =
    (argv.spa && 'spa') || (argv.universal && 'universal') || options.mode

  return options
}

export function isPromise(target) {
  return target && target.then && typeof target.then === 'function'
}
