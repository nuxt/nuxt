# `useFetch`

This composable provides a convenient wrapper around [`useAsyncData`](/api/composables/use-async-data) and [`$fetch`](/api/utils/$fetch). It automatically generates a key based on URL and fetch options, as well as infers API response type.

## Type

```ts [Signature]
function useFetch(
  url: string | Request,
  options?: UseFetchOptions
): Promise<DataT>

type UseFetchOptions = {
  key?: string,
  method?: string,
  params?: SearchParams,
  body?: RequestInit['body'] | Record<string, any>
  headers?: {key: string, value: string}[],
  baseURL?: string,
  server?: boolean
  lazy?: boolean
  default?: () => DataT
  transform?: (input: DataT) => DataT
  pick?: string[]
}

type DataT = {
  data: Ref<DataT>
  pending: Ref<boolean>
  refresh: () => Promise<void>
  error: Ref<Error | boolean>
}
```

## Params

* **Url**: The URL to fetch
* **Options (extends [unjs/ohmyfetch](https://github.com/unjs/ohmyfetch) options & [AsyncDataOptions](/api/composables/use-async-data#params))**:
  * `method`: Request method
  * `params`: Query params
  * `body`: Request body - automatically stringified (if an object is passed).
  * `headers`: Request headers
  * `baseURL`: Base URL for the request
* **Options (from `useAsyncData`)**:
  * `key`: a unique key to ensure that data fetching can be properly de-duplicated across requests, if not provided, it will be generated based on the `url` and fetch options
  * `lazy`: Whether to resolve the async function after loading the route, instead of blocking navigation (defaults to `false`).
  * `server`: Whether to fetch the data on the server (defaults to `true`).
  * `default`: A factory function to set the default value of the data, before the async function resolves - particularly useful with the `lazy: true` option.
  * `pick`: Only pick specified keys in this array from the `handler` function result.
  * `transform`: A function that can be used to alter `handler` function result after resolving.

## Return values

* **data**: the result of the asynchronous function that is passed in
* **pending**: a boolean indicating whether the data is still being fetched
* **refresh**: a function that can be used to refresh the data returned by the `handler` function
* **error**: an error object if the data fetching failed

By default, Nuxt waits until a `refresh` is finished before it can be executed again. Passing `true` as parameter skips that wait.

## Example

```ts
const { data, pending, error, refresh } = await useFetch(
  'https://api.nuxtjs.dev/mountains',
  {
    pick: ['title']
  }
)
```

:ReadMore{link="/guide/features/data-fetching"}

:LinkExample{link="/examples/composables/use-fetch"}
