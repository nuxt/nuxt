# `preloadComponents`

::StabilityEdge
::

Nuxt provides composables and utilities to give you fine-grained control over prefetching and preloading components.

> Preloading components loads components that your page will need very soon, which you want to start loading early in rendering lifecycle. This ensures they are available earlier and are less likely to block the page's render, improving performance.

You can use `preloadComponents` to manually preload individual components that have been registered globally in your Nuxt app. (By default Nuxt registers these as async components.) You must use the Pascal-cased version of the component name.

```js
await preloadComponents('MyGlobalComponent')

await preloadComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::alert{icon=👉}
Currently, on server, `preloadComponents` will have no effect.
::
