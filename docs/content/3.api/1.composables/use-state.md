# `useState`

```ts
useState<T>(key: string, init?: () => T | Ref<T>): Ref<T>
```

* **key**: A unique key ensuring that data fetching is properly de-duplicated across requests
* **init**: A function that provides initial value for the state when not initiated. This function can also return a `Ref`.
* **T**: (typescript only) Specify the type of state

::ReadMore{link="/guide/features/state-management"}
::
