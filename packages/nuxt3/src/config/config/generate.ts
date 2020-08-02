import { GlobbyOptions } from 'globby'

type GenerateRoute = string | { route: string, payload: any }

type GenerateRoutesFunction = () => (Promise<GenerateRoute[]> | GenerateRoute[])
type GenerateRoutesFunctionWithCallback = (callback: (err: Error, routes: GenerateRoute[]) => void) => void

export interface GenerateOptions {
  cache?: false | {
    ignore?: string[] | Function,
    globbyOptions?: GlobbyOptions
  }
  concurrency: number
  crawler: boolean
  devtools?: boolean
  dir: string
  exclude: RegExp[]
  fallback: boolean | string
  interval: number
  routes: GenerateRoute[] | GenerateRoutesFunction | GenerateRoutesFunctionWithCallback
  staticAssets: {
    base?: string
    versionBase?: string
    dir?: string
    version?: string
  }
  subFolders: boolean
}

export default (): GenerateOptions => ({
  dir: 'dist',
  routes: [],
  exclude: [],
  concurrency: 500,
  interval: 0,
  subFolders: true,
  fallback: '200.html',
  crawler: true,
  staticAssets: {
    base: undefined, // Default: "/_nuxt/static:
    versionBase: undefined, // Default: "_nuxt/static/{version}""
    dir: 'static',
    version: undefined // Default: "{timeStampSec}"
  }
})
