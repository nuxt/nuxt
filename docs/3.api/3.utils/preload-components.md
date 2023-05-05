---
description: Nuxt provides utilities to give you control over prefetching and preloading components.
---

# `preloadComponents`

Nuxt provides composables and utilities to give you fine-grained control over prefetching and preloading components.

> Preloading components loads components your page will need very soon, which you want to start early in the rendering lifecycle. That ensures they are available earlier and are less likely to block the page's render, improving performance.

Use `preloadComponents` to manually preload individual components registered globally in your Nuxt app. (By default, Nuxt registers these as async components.) You must use the Pascal-cased version of the component name.

```js
await preloadComponents('MyGlobalComponent')

await preloadComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::alert{icon=👉}
Currently, on the server, `preloadComponents` will have no effect.
::
