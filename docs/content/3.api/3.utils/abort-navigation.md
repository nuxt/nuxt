# `abortNavigation`

```ts
abortNavigation(err?: Error | string): false
```

* **err**: Optional error to be thrown by `abortNavigation()`.

::alert{type="warning"}
`abortNavigation()` is only usable inside a [route middleware handler](/guide/directory-structure/middleware).
::

Inside a route middleware handler, `abortNavigation()` will abort navigation, and throw an error if one is set as a parameter.

::ReadMore{link="/guide/features/routing"}
::
