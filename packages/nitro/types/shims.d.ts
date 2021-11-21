declare module '#storage' {
  import type { Storage } from 'unstorage'
  export const storage: Storage
}

declare module '#assets' {
  export interface AssetMeta { type?: string, etag?: string, mtime?: string }
  export function readAsset<T = any> (id: string): Promise<T>
  export function statAsset (id: string): Promise<AssetMeta>
  export function getKeys() : Promise<string[]>
}

declare module '#config' {
  import type { PublicRuntimeConfig, PrivateRuntimeConfig } from '@nuxt/schema'
  export const privateConfig: PrivateRuntimeConfig
  export const publicConfig: PublicRuntimeConfig
  const runtimeConfig: PrivateRuntimeConfig & PublicRuntimeConfig
  export default runtimeConfig
}
