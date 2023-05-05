---
description: Nuxt provides utilities to give you control over prefetching and preloading components.
---

# `prefetchComponents`

Nuxt provides composables and utilities to give you fine-grained control over prefetching and preloading components.

> Prefetching component downloads the code in the background based on the assumption that it will likely be used for rendering, enabling it to load instantly if and when the user requests it. The component is downloaded and cached for anticipated future use without the user explicitly requesting it.

Use `prefetchComponents` to manually prefetch individual components registered globally in your Nuxt app. (By default, Nuxt registers these as async components.) You must use the Pascal-cased version of the component name.

```js
await prefetchComponents('MyGlobalComponent')

await prefetchComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::alert{icon=👉}
The current implementation behaves the same as [`preloadComponents`](/docs/api/utils/preload-components) by preloading components instead of just prefetching. We are working to improve this behavior.
::

::alert{icon=👉}
Currently, on the server, `prefetchComponents` will have no effect.
::
