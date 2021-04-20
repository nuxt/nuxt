declare global {
  import type { $Fetch } from 'ohmyfetch'
  // eslint-disable-next-line no-var
  var $fetch: $Fetch
  namespace NodeJS {
    interface Global {
      $fetch: $Fetch
    }
  }
}

declare module '#storage' {
  import type { Storage } from 'unstorage'
  export const storage: Storage
}

declare module '#assets' {
  export interface AssetMeta { type?: string, etag?: string, mtime?: string }
  export function readAsset<T=any>(id: string): Promise<T>
  export function statAsset(id: string): Promise<AssetMeta>
  export function getAsset<T=any>(id: string): { read: () => Promise<T>, meta: AssetMeta }
}
