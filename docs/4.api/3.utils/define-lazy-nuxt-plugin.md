---
title: "defineLazyNuxtPlugin"
description: defineLazyNuxtPlugin() defines a plugin that is code-split and executed after hydration.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/nuxt.ts
    size: xs
---

`defineLazyNuxtPlugin` creates a plugin that is excluded from the critical entry bundle. The plugin is dynamically imported and executed after hydration completes (on `app:suspense:resolve`), reducing initial JS parse time for code that doesn't need to run before the app is interactive.

```ts twoslash [plugins/analytics.client.ts]
// @errors: 2307
import { init } from 'my-analytics-library'

export default defineLazyNuxtPlugin(() => {
  init({ siteId: useRuntimeConfig().public.analyticsId })
})
```

:read-more{to="/docs/4.x/directory-structure/app/plugins#lazy-plugins"}

## Type

```ts [Signature]
function defineLazyNuxtPlugin (
  plugin: ((nuxtApp: NuxtApp) => void | Promise<void>) | LazyPluginOptions,
): Plugin & ObjectPlugin

interface LazyPluginOptions {
  name?: string
  hooks?: Partial<RuntimeNuxtHooks>
  setup: (nuxtApp: NuxtApp) => void | Promise<void>
  env?: {
    islands?: boolean
  }
}
```

## Parameters

**plugin**: A lazy plugin can be defined in two ways:

1. **Function Plugin**: A function that receives the `NuxtApp` instance. Unlike `defineNuxtPlugin`, it cannot return `provide` since the app is already mounted.
2. **Object Plugin**: An object with a subset of properties — `dependsOn`, `order`, and `enforce` are not available since lazy plugins run outside the normal plugin pipeline.

| Property | Type                                   | Required | Description                                                    |
|----------|----------------------------------------|----------|----------------------------------------------------------------|
| `name`   | `string`                               | `false`  | Optional name for the plugin, useful for debugging.            |
| `setup`  | `(nuxtApp: NuxtApp) => void \| Promise<void>`{lang="ts"} | `true` | The main plugin function.                    |
| `hooks`  | `Partial<RuntimeNuxtHooks>`{lang="ts"} | `false`  | Nuxt app runtime hooks to register directly.                   |
| `env`    | `{ islands?: boolean }`{lang="ts"}     | `false`  | Control plugin behavior in island/server-only components.      |

## How It Works

At build time, Nuxt wraps lazy plugins with `_createLazyPlugin`, which:

1. Registers a one-time `app:suspense:resolve` hook during the plugin pipeline
2. After hydration, dynamically imports the plugin chunk
3. Executes the plugin's `setup` function within `nuxtApp.runWithContext`
4. If the import or setup fails, logs the error and calls `app:error`

The wrapper sets `parallel: true` so it never blocks other plugins.

::note
Lazy loading only applies on the client side — on the server, lazy plugins are included normally. Since most lazy plugins (analytics, tracking, etc.) are client-only, use the `.client.ts` suffix to avoid shipping them to the server entirely.
::

## Examples

### Analytics Plugin

```ts twoslash [plugins/analytics.client.ts]
// @errors: 2307
import { init, trackPageView } from 'my-analytics-library'

export default defineLazyNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  init({ siteId: config.public.analyticsId })

  // Track page views on each navigation
  nuxtApp.hook('page:finish', () => {
    trackPageView({ path: useRoute().fullPath })
  })
})
```

### Named Lazy Plugin with Hooks

Object syntax lets you declare hooks declaratively rather than imperatively:

```ts twoslash [plugins/error-reporting.client.ts]
// @errors: 2307
import { captureError, initErrorReporter } from 'my-error-reporter'

export default defineLazyNuxtPlugin({
  name: 'error-reporting',
  hooks: {
    'app:error' (error) {
      captureError(error)
    },
    'vue:error' (error) {
      captureError(error)
    },
  },
  setup () {
    initErrorReporter({ dsn: useRuntimeConfig().public.errorReporterDsn })
  },
})
```

### Via nuxt.config.ts

Any plugin can be made lazy via config instead of using `defineLazyNuxtPlugin`:

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  plugins: [
    { src: '~/plugins/analytics.client', lazy: true },
  ],
})
```

Or with object syntax in the plugin file itself:

```ts twoslash [plugins/analytics.client.ts]
export default defineNuxtPlugin({
  lazy: true,
  setup (nuxtApp) {
    // Runs after hydration
  },
})
```
