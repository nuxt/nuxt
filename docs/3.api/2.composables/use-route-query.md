---
title: "useRouteQuery"
description: The useRouteQuery composable simplifies working with query parameters.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/router.ts
    size: xs
---

::note
You can use `useRouteQuery` to seamlessly retrieve and update query parameters directly within your application.
::

## Example

In the following example, we create a dynamic search interface. The input field updates the `q` query parameter in the URL, which is then used to fetch data from the Google Books API.

```vue [~/pages/index.vue]
<script setup lang="ts">
const query = useRouteQuery('q');
const { data } = await useFetch('https://www.googleapis.com/books/v1/volumes', {
  params: {
    q: query,
  },
});
</script>

<template>
  <input v-model="query" placeholder="Search for books..." />
  <div v-for="book in data?.items" :key="book.id">
    {{ book.volumeInfo.title }}
  </div>
</template>
```

## Features

- **Retrieve Query Parameters**: Access specific query parameters with default values.
- **Update Query Parameters**: Dynamically modify query parameters, reflecting changes in the URL.
- **Automatic Cleanup**: Remove empty or default parameters with configurable options.

## API

### `useRouteQuery(param, defaultValue, options)`

#### Parameters

- `param` (String): The name of the query parameter to manage.
- `defaultValue` (String): The default value if the query parameter is not present.
- `options` (Object):
  - `removeEmpty` (Boolean): Remove parameters with empty values. Default: `true`.
  - `removeDefault` (Boolean): Remove parameters equal to the default value. Default: `true`.

#### Returns

A `computed` object with:

- **`get`**: Retrieves the current value of the query parameter or the default value.
- **`set`**: Updates the query parameter in the URL.

## Additional Examples

### Basic Retrieval

Retrieve a query parameter with a default value fallback:

```javascript
const searchQuery = useRouteQuery('search', 'defaultSearch');
console.log(searchQuery.value); // Outputs: 'defaultSearch' if `?search` is not in the URL
```

### Dynamic Updates

Update the query parameter dynamically:

```javascript
const searchQuery = useRouteQuery('search', 'defaultSearch');
searchQuery.value = 'newSearchValue';
// URL updates to include `?search=newSearchValue`
searchQuery.value = '';
// URL removes `?search` due to `removeEmpty: true`
```

### Custom Options

Customize behavior with options:

```javascript
const filterQuery = useRouteQuery('filter', 'all', {
  removeEmpty: false,
  removeDefault: false,
});
filterQuery.value = '';
// URL remains `?filter=` because `removeEmpty` is `false`
filterQuery.value = 'all';
// URL remains `?filter=all` because `removeDefault` is `false`
```

### Toggle Query Parameter

Manage a toggle state with a query parameter:

```javascript
const isVisible = useRouteQuery('visible', false);
function toggleVisibility() {
  isVisible.value = !isVisible.value;
}
// Updates the URL to `?visible=true` or removes `?visible`
```

### Managing Multiple Query Parameters

Handle multiple query parameters simultaneously:

```javascript
const category = useRouteQuery('category', 'all');
const sort = useRouteQuery('sort', 'asc');
category.value = 'books';
sort.value = 'desc';
// URL updates to `?category=books&sort=desc`
```

## Notes

- Ensure that `useRouteQuery` is used within a Nuxt component or setup function to access `useRoute` and `useRouter`.
- Query updates replace the entire query object. Ensure no unintended parameters are overwritten.

## Limitations

- This composable does not handle deeply nested query parameters.
- It is designed for flat query structures only.

::read-more{icon="i-simple-icons-vuedotjs" to="https://vuejs.org/api/reactivity-core.html#computed"}
