/// <reference path="../../pages/build.d.ts" />
/// <reference path="../../../../nitro-server/src/augments.ts" />

declare global {
  interface ImportMeta {
    readonly hot?: {
      accept (cb?: (mod: any) => void): void
      accept (dep: string, cb: (mod: any) => void): void
      on (event: string, cb: (payload: any) => void): void
      data: any
    }
    readonly webpackHot?: {
      accept (path?: string, cb?: () => void): void
      dispose (cb: (data: any) => void): void
    }
  }

  var __NUXT_VERSION__: string
  var __NUXT_ASYNC_CONTEXT__: boolean
}

export {}
