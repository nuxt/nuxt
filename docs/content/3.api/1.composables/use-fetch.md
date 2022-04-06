# `useFetch`

```ts
const {
  data: Ref<DataT>,
  pending: Ref<boolean>,
  refresh: (force?: boolean) => Promise<void>,
  error?: any
} = useFetch(url: string, options?)
```

Available options:

* `key`: Provide a custom key
* Options from [ohmyfetch](https://github.com/unjs/ohmyfetch)
  * `method`: Request method
  * `params`: Query params
  * `headers`: Request headers
  * `baseURL`: Base URL for the request
* Options from `useAsyncData`
  * `lazy`
  * `server`
  * `default`
  * `pick`
  * `transform`

The object returned by `useFetch` has the same properties as that returned by `useAsyncData` ([see above](#useasyncdata)).

::ReadMore{link="/guide/features/data-fetching"}
::

::ReadMore{link="/api/composables/use-async-data"}
::
