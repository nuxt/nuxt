# Data Fetching

Nuxt provides `asyncData` to handle data fetching within you application.

## `asyncData`

Within your pages and components you can use `asyncData` to get access to data that resolves asynchronously. (This helper only works within a component defined with `defineNuxtComponent`).

### Usage

```js
asyncData(key: string, fn: () => Object, options?: { defer: boolean, server: boolean })
```

* **key**: a unique key to ensure that data fetching can be properly de-duplicated across requests
* **fn** an asynchronous function that must return an object.
* **options**:
  - _defer_: whether to load the route before resolving the async function (defaults to `false`)
  - _server_: whether the fetch the data on server-side (defaults to `true`)

Under the hood, `defer: false` uses `<Suspense>` to block the loading of the route before the data has been fetched. Consider using `defer: true` and implementing a loading state instead for a snappier user experience.

### Example

```vue
<template>
  Page visits: {{ data.count }}
</template>

<script>
import { asyncData, defineNuxtComponent } from '@nuxt/app'

export default defineNuxtComponent({
  setup () {
    const { data } = asyncData('time', () => $fetch('/api/count'))
    return { data }
  }
})
</script>
```

