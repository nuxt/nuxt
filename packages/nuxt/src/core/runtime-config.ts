import { configDiagnostics, findRuntimeConfigSchema, resolveRuntimeConfig } from '@nuxt/kit/internal'
import type { Nuxt } from 'nuxt/schema'

import { formatRuntimeConfigIssues } from '../runtime/server/runtime-config/schema.ts'

export function assertRuntimeConfigWithoutSchemas (nuxt: Nuxt): void {
  const path = findRuntimeConfigSchema(nuxt.options.runtimeConfig)
  if (path) {
    throw configDiagnostics.NUXT_B5033({ path: ['runtimeConfig', ...path].join('.') })
  }
}

export function checkRuntimeConfig (nuxt: Nuxt): void {
  const { issues } = resolveRuntimeConfig(nuxt)
  if (issues.length) {
    configDiagnostics.NUXT_B5032({ issues: formatRuntimeConfigIssues(issues) })
  }
}
