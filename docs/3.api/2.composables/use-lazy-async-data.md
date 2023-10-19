---
title: useLazyAsyncData
description: This wrapper around useAsyncData triggers navigation immediately.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

## Description

By default, [`useAsyncData`](/docs/api/composables/use-async-data) blocks navigation until its async handler is resolved. `useLazyAsyncData` provides a wrapper around [`useAsyncData`](/docs/api/composables/use-async-data) that triggers navigation before the handler is resolved by setting the `lazy` option to `true`.

::callout
`useLazyAsyncData` has the same signature as [`useAsyncData`](/docs/api/composables/use-async-data).
::

:read-more{to="/docs/api/composables/use-async-data"}

## Example

```vue [pages/index.vue]
<script setup lang="ts">
/* Navigation will occur before fetching is complete.
  Handle pending and error states directly within your component's template
*/
const { pending, data: count } = await useLazyAsyncData('count', () => $fetch('/api/count'))

watch(count, (newCount) => {
  // Because count might start out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>

<template>
  <div>
    {{ pending ? 'Loading' : count }}
  </div>
</template>
```

::callout{color="amber" icon="i-ph-warning-duotone"}
`useLazyAsyncData` is a reserved function name transformed by the compiler, so you should not name your own function `useLazyAsyncData`.
::

:read-more{to="/docs/getting-started/data-fetching#uselazyasyncdata"}
