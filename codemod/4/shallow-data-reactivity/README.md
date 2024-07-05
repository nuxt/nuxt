This codemod transforms the `data` object returned from `useAsyncData`, `useFetch`, `useLazyAsyncData` and `useLazyFetch` into a `shallowRef`

When new data is fetched, anything depending on `data` will still be reactive because the entire object is replaced. But if your code changes a property within that data structure, this will not trigger any reactivity in your app.

This brings a significant performance improvement for deeply nested objects and arrays because Vue does not need to watch every single property/array for modification. In most cases, data should also be immutable.

## Before

```jsx
const { data } = useFetch('/api/test')
```

> This can apply to all useAsyncData, useFetch, useLazyAsyncData and useLazyFetch.

## After

```jsx
const { data } = useFetch('/api/test', { deep: true })
```

### Additional Feature

This codemod ensures that any unique key of your data is always resolvable to the same data. For example, if you are using `useAsyncData` to fetch data related to a particular page, it should be changed to a key that uniquely matches that data. (`useFetch` should do this automatically for you.)

### Example

Code before transformation:

```jsx
const route = useRoute()
const { data } = await useAsyncData(async () => {
    return await $fetch(`/api/my-page/${route.params.slug}`)
});
```

Code after transformation:

```jsx
const route = useRoute()
const { data } = await useAsyncData(route.params.slug, async () => {
    return await $fetch(`/api/my-page/${route.params.slug}`), { deep: true }
});
```
