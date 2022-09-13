# `useLazyFetch`

## Description

By default, [useFetch](/api/composables/use-fetch) blocks navigation until its async handler is resolved.

`useLazyFetch` provides a wrapper around `useFetch` that triggers navigation before the handler is resolved by setting the `lazy` option to `true`.

> `useLazyFetch` has the same signature as `useFetch`.

:ReadMore{link="/api/composables/use-fetch"}

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
const { pending, data: posts } = useLazyFetch('/api/posts')
watch(posts, (newPosts) => {
  // Because posts starts out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>
```

:ReadMore{link="/getting-started/data-fetching#uselazyfetch"}
