# `useState`

```ts
useState<T>(key: string, init?: () => T): Ref<T>
```

* **key**: A unique key ensuring that data fetching can be properly de-duplicated across requests
* **init**: A function that provides initial value for the state when it's not initiated
* **T**: (typescript only) Specify the type of state

::ReadMore{link="/guide/features/state-management"}
::
