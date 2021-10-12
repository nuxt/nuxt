import { existsSync, promises as fsp } from 'fs'
import { resolve } from 'pathe'
import dotenv from 'dotenv'
import { LoadNuxtConfigOptions } from './load'

export interface LoadDotEnvOptions {
  /** The project root directory (either absolute or relative to the current working directory). */
  rootDir: string
  /**
   * What file to look in for environment variables (either absolute or relative
   * to the current working directory). For example, `.env`.
   */
  dotenvFile: string | false
  /**
   * Whether to interpolate variables within .env.
   *
   * @example
   * ```env
   * BASE_DIR="/test"
   * # resolves to "/test/further"
   * ANOTHER_DIR="${BASE_DIR}/further"
   * ```
   */
  expand: boolean
  /** An object describing environment variables (key, value pairs). */
  env: NodeJS.ProcessEnv
}

/**
 * Load and interpolate environment variables into `process.env`.
 * If you need more control (or access to the values), consider using `loadDotenv` instead
 *
 * @param rootDir - The project root directory (either absolute or relative to the current working directory).
 */
export async function loadEnv (rootDir: string, options: LoadNuxtConfigOptions['envConfig'] = {}) {
  const targetEnv = options.env ?? process.env

  // Load env
  const env = await loadDotenv({
    rootDir,
    dotenvFile: options.dotenv ?? '.env',
    env: targetEnv,
    expand: options.expand ?? true
  })

  // Fill process.env so it is accessible in nuxt.config
  for (const key in env) {
    if (!key.startsWith('_') && targetEnv[key] === undefined) {
      targetEnv[key] = env[key]
    }
  }
}

/** Load environment variables into an object. */
export async function loadDotenv (opts: LoadDotEnvOptions) {
  if (!opts.dotenvFile) {
    return
  }

  const env = Object.create(null)

  const dotenvFile = resolve(opts.rootDir, opts.dotenvFile)

  if (existsSync(dotenvFile)) {
    const parsed = dotenv.parse(await fsp.readFile(dotenvFile, 'utf-8'))
    Object.assign(env, parsed)
  }

  // Apply process.env
  if (!opts.env._applied) {
    Object.assign(env, opts.env)
    env._applied = true
  }

  // Interpolate env
  if (opts.expand) {
    expand(env)
  }

  return env
}

// Based on https://github.com/motdotla/dotenv-expand
function expand (target: Record<string, any>, source: Record<string, any> = {}, parse = (v: any) => v) {
  function getValue (key: string) {
    // Source value 'wins' over target value
    return source[key] !== undefined ? source[key] : target[key]
  }

  function interpolate (value: unknown, parents: string[] = []) {
    if (typeof value !== 'string') {
      return value
    }
    const matches = value.match(/(.?\${?(?:[a-zA-Z0-9_:]+)?}?)/g) || []
    return parse(matches.reduce((newValue, match) => {
      const parts = /(.?)\${?([a-zA-Z0-9_:]+)?}?/g.exec(match)
      const prefix = parts[1]

      let value, replacePart: string

      if (prefix === '\\') {
        replacePart = parts[0]
        value = replacePart.replace('\\$', '$')
      } else {
        const key = parts[2]
        replacePart = parts[0].substring(prefix.length)

        // Avoid recursion
        if (parents.includes(key)) {
          console.warn(`Please avoid recursive environment variables ( loop: ${parents.join(' > ')} > ${key} )`)
          return ''
        }

        value = getValue(key)

        // Resolve recursive interpolations
        value = interpolate(value, [...parents, key])
      }

      return value !== undefined ? newValue.replace(replacePart, value) : newValue
    }, value))
  }

  for (const key in target) {
    target[key] = interpolate(getValue(key))
  }
}
