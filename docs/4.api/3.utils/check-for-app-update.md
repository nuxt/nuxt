---
title: 'checkForAppUpdate'
description: Check for a newer deployment of your Nuxt application.
minimalVersion: "5.0"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/manifest.ts
    size: xs
---

## Usage

`checkForAppUpdate` immediately checks whether a newer build is available. When it finds one, it calls the `app:manifest:update` hook with the new build's metadata, just like Nuxt's automatic build checks.

You can call it when a user returns to your application or requests an update check, without waiting for the next automatic check. Concurrent calls share the same request.

::note
This utility requires `experimental.appManifest` to be enabled. It works even when `experimental.checkOutdatedBuildInterval` is `false`.
::

## Type

```ts [Signature]
export function checkForAppUpdate (): Promise<NuxtAppManifestMeta | undefined>

interface NuxtAppManifestMeta {
  id: string
  timestamp: number
}
```

## Return Values

Returns the newer build's metadata, or `undefined` when the build is unchanged or the latest manifest cannot be fetched. On the server, or when the app manifest is disabled, it returns `undefined` without making a request.

The promise rejects if the current build's manifest cannot be loaded, unless the server responds with HTTP 403 or 404.

The utility emits `app:manifest:update` rather than reloading the application itself. Existing Nuxt hooks, including those configured by `experimental.emitRouteChunkError`, still handle that event.

## Example

```ts [app/plugins/check-for-update.client.ts]
export default defineNuxtPlugin(() => {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForAppUpdate().catch(() => {})
    }
  })
})
```
