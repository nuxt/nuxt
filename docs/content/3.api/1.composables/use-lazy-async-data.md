# `useLazyAsyncData`

This composable behaves identically to [useAsyncData](/api/composables/use-async-data) with the `lazy: true` option set.  

Otherwise, this function does not block navigation. That means you will need to handle the situation where the data is `null` (or whatever value you have provided in a custom `default` factory function).

::ReadMore{link="/api/composables/use-async-data"}
::

## Example

```vue
<template>
  <div>
    {{ pending ? 'Loading' : count }}
  </div>
</template>

<script setup>
const { pending, data: count } = useLazyAsyncData('count', () => $fetch('/api/count'))
watch(count, (newCount) => {
  // Because count starts out null, you won't have access
  // to its contents immediately, but you can watch it.
})
</script>
```

::ReadMore{link="/guide/features/data-fetching"}
::
