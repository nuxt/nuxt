---
title: 'useNuxtData'
description: 'Access the current cached value of data fetching composables.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts
    size: xs
---

::callout
`useNuxtData` gives you access to the current cached value of [`useAsyncData`](/docs/api/composables/use-async-data) , `useLazyAsyncData`, [`useFetch`](/docs/api/composables/use-fetch) and [`useLazyFetch`](/docs/api/composables/use-lazy-fetch) with explicitly provided key.
::

## Usage

The example below shows how you can use cached data as a placeholder while the most recent data is being fetched from the server.

```vue [pages/posts.vue]
<script setup>
// We can access same data later using 'posts' key
const { data } = await useFetch('/api/posts', { key: 'posts' })
</script>
```

```ts [pages/posts/[id\\].vue]
// Access to the cached value of useFetch in posts.vue (parent route)
const { id } = useRoute().params
const { data: posts } = useNuxtData('posts')
const { data } = useLazyFetch(`/api/posts/${id}`, {
  key: `post-${id}`,
  default() {
    // Find the individual post from the cache and set it as the default value.
    return posts.value.find(post => post.id === id)
  }
})
```

## Optimistic Updates

We can leverage the cache to update the UI after a mutation, while the data is being invalidated in the background.

```vue [pages/todos.vue]
<script setup>
// We can access same data later using 'todos' key
const { data } = await useAsyncData('todos', () => $fetch('/api/todos'))
</script>
```

```vue [components/NewTodo.vue]
<script setup>
const newTodo = ref('')
const previousTodos = ref([])

// Access to the cached value of useFetch in todos.vue
const { data: todos } = useNuxtData('todos')

const { data } = await useFetch('/api/addTodo', {
  method: 'post',
  body: {
    todo: newTodo.value
  },
  onRequest () {
    previousTodos.value = todos.value // Store the previously cached value to restore if fetch fails.

    todos.value.push(newTodo.value) // Optimistically update the todos.
  },
  onRequestError () {
    todos.value = previousTodos.value // Rollback the data if the request failed.
  },
  async onResponse () {
    await refreshNuxtData('todos') // Invalidate todos in the background if the request succeeded.
  }
})
</script>
```

## Type

```ts
useNuxtData<DataT = any> (key: string): { data: Ref<DataT | null> }
```
