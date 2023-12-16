---
title: "once"
description: "Run a given function or block of code once SSR or CSR."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/error.ts
    size: xs
---

## Purpose

The `once` function is designed to execute a given function or block of code only a single time in a specific scenario:
- During server-side rendering but not during hydration
- On client-side navigation

This is useful for code that should only be executed once, such as logging an event or setting up a global state.

## Usage

```vue [app.vue]
<script setup>
const websiteConfig = useState('config')

await once(async () => {
  console.log('This will only be logged once')
  websiteConfig.value = await $fetch('https://my-cms.com/api/website-config')
})
</script>
```

::callout{to="/docs/getting-started/state-management#usage-with-pinia"}
`once` is useful in combination with the [Pinia module](/modules/pinia) to call store actions.
::

:read-more{to="/docs/getting-started/state-management"}

::callout{color="info" icon="i-ph-warning-duotone"}
Note that `once` won't return anything, you should use [`useAsyncData`](/docs/api/composables/use-async-data) or [`useFetch`](/docs/api/composables/use-fetch) if you want to do data-fetching during SSR.
::

## Type

```ts
once(fn?: () => any | Promise<any>): Promise<void>
once(key: string, fn?: () => any | Promise<any>): Promise<void>
```

- `key`: A unique key ensuring that the code is run once. If you do not provide a key, then a key that is unique to the file and line number of the instance of `once` will be generated for you.
- `fn`: The function code to run once. This function can also return a `Promise` and a value.
