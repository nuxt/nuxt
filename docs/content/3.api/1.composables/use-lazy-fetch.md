# `useLazyFetch`

This composable behaves identically to [useFetch](/api/composables/use-fetch) with the `lazy: true` option set.  

Otherwise, this function does not block navigation. That means you will need to handle the situation where the data is `null` (or whatever value you have provided in a custom `default` factory function).

::ReadMore{link="/api/composables/use-fetch"}
::

## Example

```vue
<template>
  <!-- you'll need to handle a loading state -->
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
const { pending, data: posts } = useLazyFetch('/api/posts')
watch(posts, (newPosts) => {
  // Because posts starts out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>
```

::ReadMore{link="/guide/features/data-fetching"}
::
