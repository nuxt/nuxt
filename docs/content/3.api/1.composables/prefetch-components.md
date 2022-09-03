# `prefetchComponents`

Nuxt provides composables and utilities to give you fine-grained control over prefetching and preloading components.

> Prefetching component downloads the code in the background, this is based on the assumption that the component will likely be used for rendering, enabling the component to load instantly if and when the user requests it. The component is downloaded and cached for anticipated future use without the user making an explicit request for it.

You can use `prefetchComponents` to manually prefetch individual components that have been registered globally in your Nuxt app. (By default Nuxt registers these as async components.) You must use the Pascal-cased version of the component name.

```js
await prefetchComponents('MyGlobalComponent')

await prefetchComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::alert{icon=👉}
Current implementation behaves exactly the same as [`preloadComponents`](/api/composables/preload-components) by preloading components instead of just prefetching we are working to improve this behavior.
::

::alert{icon=👉}
Currently, on server, `prefetchComponents` will have no effect.
::
