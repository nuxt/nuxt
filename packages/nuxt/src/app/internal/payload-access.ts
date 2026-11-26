import { appGlobalName, appId, appPayloadDataAttr, appPayloadId, multiApp } from '#build/nuxt.config.mjs'

/**
 * Locate the inline hydration payload `<script>` element using the build-configured selector strategy.
 * Reading config constants directly from `#build/nuxt.config.mjs` lets bundlers tree-shake unused branches.
 * @internal
 */
export function findPayloadElement (id?: string): HTMLElement | null {
  if (!multiApp && appPayloadId) {
    return document.getElementById(appPayloadId)
  }
  if (appPayloadDataAttr) {
    const attr = globalThis.CSS?.escape?.(appPayloadDataAttr) ?? appPayloadDataAttr
    return document.querySelector(`[${attr}="${id || appId}"]`) as HTMLElement | null
  }
  return appPayloadId ? document.getElementById(appPayloadId) : null
}

/**
 * Read initial payload/config placed on `window` (or a hidden `Symbol.for` slot when `appGlobalName` is `false`).
 * @internal
 */
export function readGlobalPayload (id?: string): Record<string, any> | undefined {
  if (!import.meta.client) { return undefined }
  if (appGlobalName) {
    return multiApp ? (window as any)[appGlobalName]?.[id || appId] : (window as any)[appGlobalName]
  }
  return (window as any)[Symbol.for(appPayloadId || id || appId)]
}
