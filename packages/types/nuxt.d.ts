import type { RequestListener } from 'http'
import type { NuxtOptions } from './config'

export interface Nuxt {
  options: NuxtOptions,
  server: { app: RequestListener },
  ready: () => any
  close: (callback?: Function) => any
  resolver: any
  moduleContainer: any
  resolveAlias(path: string): string
  resolvePath(path: string, opts?: any): string
  renderRoute(...args: any[]): any
  renderAndGetWindow(url: string, opts?: any, config?: any): any
  [key: string]: any
}
