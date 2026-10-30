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

The current and latest manifest requests each time out after 30 seconds, including reading their response bodies. Later checks can retry after a timeout.

Errors loading the current build's manifest, including timeouts, are propagated, except for HTTP 403 and 404 responses, which allow checking for a newer build even when the old manifest has been removed. Automatic polling retries on the next interval after an error.

The utility emits `app:manifest:update` rather than reloading the application itself. Existing Nuxt hooks, including those configured by `experimental.emitRouteChunkError`, still handle that event.

## Example

Use `runWithContext` to retain the Nuxt context when calling the utility from an event handler:

```vue [app/components/CheckForUpdate.vue]
<script setup lang="ts">
const nuxtApp = useNuxtApp()
const status = ref('')

async function check () {
  try {
    const update = await nuxtApp.runWithContext(() => checkForAppUpdate())
    status.value = update ? 'An update is available.' : 'No update was found.'
  } catch {
    status.value = 'Unable to check for an update.'
  }
}
</script>

<template>
  <button @click="check">
    Check for updates
  </button>
  <p role="status">
    {{ status }}
  </p>
</template>
```
