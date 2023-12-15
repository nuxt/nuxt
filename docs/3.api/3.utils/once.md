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

You can also get the returned value of the function:

```vue [pages/stats.vue]
<script setup>
const stats = await once(() => $fetch('https://example.com/api/stats'))
</script>
```

::callout
Note that `stats` won't be reactive in this case and if an error happen you will [have to handle it](/docs/getting-started/error-handling#error-page), if you want to do data fetching and have it be reactive, you should use [`useAsyncData`](/docs/api/composables/use-async-data) or [`useFetch`](/docs/api/composables/use-fetch).
::

## Type

```ts
once<T>(fn?: () => T | Promise<T>): Promise<T>
once<T>(key: string, fn?: () => T | Promise<T>): Promise<T>
```

- `key`: A unique key ensuring that the code is run once. If you do not provide a key, then a key that is unique to the file and line number of the instance of `once` will be generated for you.
- `fn`: The function code to run once. This function can also return a `Promise` and a value.
- `T`: (typescript only) Specify the type of returned value
