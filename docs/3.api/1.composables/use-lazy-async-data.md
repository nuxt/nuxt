---
description: This wrapper around useAsyncData triggers navigation immediately.
---

# `useLazyAsyncData`

`useLazyAsyncData` provides a wrapper around `useAsyncData` that triggers navigation before the handler gets resolved by setting the `lazy` option to `true`.

## Description

By default, [useAsyncData](/docs/api/composables/use-async-data) blocks navigation until its async handler gets resolved.

> `useLazyAsyncData` has the same signature as `useAsyncData`.

:ReadMore{link="/docs/api/composables/use-async-data"}

## Example

```vue
<template>
  <div>
    {{ pending ? 'Loading' : count }}
  </div>
</template>

<script setup>
/* Navigation will occur before fetching is complete.
  Handle pending and error states directly within your component's template.
*/
const { pending, data: count } = await useLazyAsyncData('count', () => $fetch('/api/count'))

watch(count, (newCount) => {
  // Because `count` is null at the beginning, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>
```

::alert{type=warning}
`useLazyAsyncData` is a reserved function name transformed by the compiler, so you should not name your function `useLazyAsyncData`.
::

:ReadMore{link="/docs/getting-started/data-fetching#uselazyasyncdata"}
