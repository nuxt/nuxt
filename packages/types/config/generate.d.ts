import { GlobbyOptions } from 'globby'

/**
 * NuxtOptionsGenerate
 * Documentation: https://nuxtjs.org/api/configuration-generate
 */

type NuxtOptionsGenerateRoute = string | { route: string, payload: any }

type NuxtOptionsGenerateRoutesFunction = () => (Promise<NuxtOptionsGenerateRoute[]> | NuxtOptionsGenerateRoute[])
type NuxtOptionsGenerateRoutesFunctionWithCallback = (callback: (err: Error, routes: NuxtOptionsGenerateRoute[]) => void) => void

export interface NuxtOptionsGenerate {
  concurrency?: number
  crawler?: boolean
  devtools?: boolean
  dir?: string
  exclude?: RegExp[]
  fallback?: string | boolean
  interval?: number
  routes?: NuxtOptionsGenerateRoute[] | NuxtOptionsGenerateRoutesFunction | NuxtOptionsGenerateRoutesFunctionWithCallback
  subFolders?: boolean
  cache?: false | {
    // eslint-disable-next-line @typescript-eslint/ban-types
    ignore?: string[] | Function,
    globbyOptions?: GlobbyOptions
  }
}
