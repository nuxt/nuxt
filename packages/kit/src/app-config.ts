import { defu } from 'defu'
import { useNuxt } from './context.ts'

/**
 * Update Nuxt app configuration.
 * @since 4.5.0
 */
export function updateAppConfig (appConfig: Record<string, unknown>): void {
  const nuxt = useNuxt()
  Object.assign(nuxt.options.appConfig, defu(appConfig, nuxt.options.appConfig))
}
