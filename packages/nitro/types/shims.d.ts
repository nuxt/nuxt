declare module '#storage' {
  import type { Storage } from 'unstorage'
  export const storage: Storage
}

declare module '#assets' {
  export interface AssetMeta { type?: string, etag?: string, mtime?: string }

  export const assets: {
    getKeys(): Promise<string[]>
    hasItem(id: string): Promise<boolean>
    getItem<T = any> (id: string): Promise<T>
    getMeta(id: string): Promise<AssetMeta>
  }
}

declare module '#config' {
  import type { PublicRuntimeConfig, PrivateRuntimeConfig } from '@nuxt/schema'
  export const privateConfig: PrivateRuntimeConfig
  export const publicConfig: PublicRuntimeConfig
  const runtimeConfig: PrivateRuntimeConfig & PublicRuntimeConfig
  export default runtimeConfig
}

declare module '#paths' {
  export const baseURL: () => string
  export const buildAssetsDir: () => string

  export const buildAssetsURL: (...path: string[]) => string
  export const publicAssetsURL: (...path: string[]) => string
}
