import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { isDebug, isDevelopment, isTest } from 'std-env'
import type { NuxtDebugOptions, NuxtOptions } from '@nuxt/schema'

import { optionsDiagnostics } from '../diagnostics.ts'
import { bool, isObject, oneOf } from '../validate.ts'
import type { RawConfig } from '../validate.ts'

export type EnvOptions = Pick<NuxtOptions, 'dev' | 'test' | 'envName' | 'buildId' | 'debug' | 'ssr' | 'logLevel'>

const LOG_LEVELS = ['silent', 'info', 'verbose'] as const

export function resolveEnv (input: RawConfig): EnvOptions {
  const dev = bool('dev', input.dev, Boolean(isDevelopment))
  const test = bool('test', input.test, Boolean(isTest))

  let logLevel: NuxtOptions['logLevel'] = test ? 'silent' : 'info'
  if (input.logLevel && typeof input.logLevel === 'string' && !LOG_LEVELS.includes(input.logLevel as typeof LOG_LEVELS[number])) {
    optionsDiagnostics.NUXT_B5012({ value: input.logLevel })
  } else {
    logLevel = oneOf('logLevel', input.logLevel, LOG_LEVELS, logLevel)
  }

  return {
    dev,
    test,
    envName: typeof input.envName === 'string' ? input.envName : (dev ? 'development' : 'production'),
    buildId: typeof input.buildId === 'string' ? input.buildId : (dev ? 'dev' : test ? 'test' : randomUUID()),
    debug: resolveDebug(input.debug),
    ssr: bool('ssr', input.ssr, true),
    logLevel,
  }
}

function resolveDebug (value: unknown): NuxtDebugOptions | false {
  value ??= isDebug
  const perfEnv = process.env.NUXT_DEBUG_PERF
  const perf = perfEnv === 'quiet' ? 'quiet' : true
  if (value === true) {
    return {
      templates: true,
      modules: true,
      watchers: true,
      hooks: {
        client: true,
        server: true,
      },
      nitro: true,
      router: true,
      hydration: true,
      perf,
    } satisfies Required<NuxtDebugOptions>
  }
  if (isObject(value)) {
    return perfEnv ? { ...value, perf } : value
  }
  return perfEnv ? { perf } : false
}
