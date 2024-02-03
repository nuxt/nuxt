---
title: "callOnce"
description: "Run a given function or block of code once during SSR or CSR."
navigation:
  badge: New
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/once.ts
    size: xs
---

::callout{icon="i-ph-info-duotone" color="blue"}
This utility is available since [Nuxt v3.9](/blog/v3-9).
::

## Purpose

The `callOnce` function is designed to execute a given function or block of code only once during:
- server-side rendering but not hydration
- client-side navigation

This is useful for code that should be executed only once, such as logging an event or setting up a global state.

## Usage

```vue [app.vue]
<script setup>
const websiteConfig = useState('config')

await callOnce(async () => {
  console.log('This will only be logged once')
  websiteConfig.value = await $fetch('https://my-cms.com/api/website-config')
})
</script>
```

::callout{to="/docs/getting-started/state-management#usage-with-pinia"}
`callOnce` is useful in combination with the [Pinia module](/modules/pinia) to call store actions.
::

:read-more{to="/docs/getting-started/state-management"}

::callout{color="info" icon="i-ph-warning-duotone"}
Note that `callOnce` doesn't return anything. You should use [`useAsyncData`](/docs/api/composables/use-async-data) or [`useFetch`](/docs/api/composables/use-fetch) if you want to do data fetching during SSR.
::

::callout
`callOnce` is a composable meant to be called directly in a setup function, plugin, or route middleware, because it needs to add data to the Nuxt payload to avoid re-calling the function on the client when the page hydrates.
::

## Type

```ts
callOnce(fn?: () => any | Promise<any>): Promise<void>
callOnce(key: string, fn?: () => any | Promise<any>): Promise<void>
```

- `key`: A unique key ensuring that the code is run once. If you do not provide a key, then a key that is unique to the file and line number of the instance of `callOnce` will be generated for you.
- `fn`: The function to run once. This function can also return a `Promise` and a value.
