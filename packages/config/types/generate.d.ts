/**
 * NuxtConfigurationGenerate
 * Documentation: https://nuxtjs.org/api/configuration-generate
 */

type NuxtConfigurationGenerateRoute = string | { route: string, payload: any }

type NuxtConfigurationGenerateRoutesFunction = () => (Promise<NuxtConfigurationGenerateRoute[]> | NuxtConfigurationGenerateRoute[])
type NuxtConfigurationGenerateRoutesFunctionWithCallback = (callback: (err: Error, routes: NuxtConfigurationGenerateRoute[]) => void) => void

export interface NuxtConfigurationGenerate {
  concurrency?: number
  devtools?: boolean
  dir?: string
  fallback?: string | boolean
  interval?: number
  routes?: NuxtConfigurationGenerateRoute[] | NuxtConfigurationGenerateRoutesFunction | NuxtConfigurationGenerateRoutesFunctionWithCallback
  subFolders?: boolean
}
