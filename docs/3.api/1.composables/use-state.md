---
title: "useState"
description: The useState composable creates a reactive and SSR-friendly shared state.
---

# `useState`

```ts
useState<T>(init?: () => T | Ref<T>): Ref<T>
useState<T>(key: string, init?: () => T | Ref<T>): Ref<T>
```

* **key**: A unique key ensuring that data fetching is properly de-duplicated across requests. If you do not provide a key, a key unique to the file and line number of the instance of `useState` will be generated.
* **init**: A function that provides the initial value for the state when not initiated. This function can also return a `Ref`.
* **T**: (typescript only) Specify the type of state

::alert{type=warning}
Because the data inside `useState` will be serialized to JSON, it mustn't contain anything unserializable, such as classes, functions, or symbols.
::

::alert{type=warning}
`useState` is a reserved function name transformed by the compiler, so you should not name your function `useState`.
::

::ReadMore{link="/docs/getting-started/state-management"}
::
