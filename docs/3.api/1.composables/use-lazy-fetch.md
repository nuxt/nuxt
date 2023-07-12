---
description: This wrapper around useFetch triggers navigation immediately.
---

# `useLazyFetch`

`useLazyFetch` provides a wrapper around [`useFetch`](/docs/api/composables/use-fetch) that triggers navigation before the handler is resolved by setting the `lazy` option to `true`.

## Description

By default, [useFetch](/docs/api/composables/use-fetch) blocks navigation until its async handler is resolved.

> [`useLazyFetch`](/docs/api/composables/use-lazy-fetch) has the same signature as `useFetch`.

:ReadMore{link="/docs/api/composables/use-fetch"}

## Example

```vue
<template>
  <div v-if="pending">
    Loading ...
  </div>
  <div v-else>
    <div v-for="post in posts">
      <!-- do something -->
    </div>
  </div>
</template>

<script setup>
/* Navigation will occur before fetching is complete.
  Handle pending and error states directly within your component's template
*/
const { pending, data: posts } = await useLazyFetch('/api/posts')
watch(posts, (newPosts) => {
  // Because posts might start out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>
```

::alert{type=warning}
`useLazyFetch` is a reserved function name transformed by the compiler, so you should not name your own function `useLazyFetch`.
::

:ReadMore{link="/docs/getting-started/data-fetching#uselazyfetch"}
