import { resolve } from 'path'
import { existsSync, promises as fsp } from 'fs'
import dotenv from 'dotenv'

export interface LoadDotEnvOptions {
  rootDir: string
  dotenvFile: string
  expand: boolean
  env: typeof process.env
}

export async function loadEnv (rootDir) {
  // Load env
  const env = await loalDotenv({
    rootDir,
    dotenvFile: '.env',
    env: process.env,
    expand: true
  })

  // Fill process.env so it is accessible in nuxt.config
  for (const key in env) {
    if (!key.startsWith('_') && process.env[key] === undefined) {
      process.env[key] = env[key]
    }
  }
}

export async function loalDotenv (opts: LoadDotEnvOptions) {
  const env = Object.create(null)

  const dotenvFile = resolve(opts.rootDir, opts.dotenvFile)

  if (await existsSync(dotenvFile)) {
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
function expand (target, source = {}, parse = v => v) {
  function getValue (key) {
    // Source value 'wins' over target value
    return source[key] !== undefined ? source[key] : target[key]
  }

  function interpolate (value, parents = []) {
    if (typeof value !== 'string') {
      return value
    }
    const matches = value.match(/(.?\${?(?:[a-zA-Z0-9_:]+)?}?)/g) || []
    return parse(matches.reduce((newValue, match) => {
      const parts = /(.?)\${?([a-zA-Z0-9_:]+)?}?/g.exec(match)
      const prefix = parts[1]

      let value, replacePart

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
