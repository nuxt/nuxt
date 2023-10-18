---
title: 'preloadComponents'
description: Nuxt provides utilities to give you control over preloading components.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/preload.ts
    size: xs
---

Preloading components loads components that your page will need very soon, which you want to start loading early in rendering lifecycle. This ensures they are available earlier and are less likely to block the page's render, improving performance.

Use `preloadComponents` to manually preload individual components that have been registered globally in your Nuxt app. By default Nuxt registers these as async components. You must use the Pascal-cased version of the component name.

```js
await preloadComponents('MyGlobalComponent')

await preloadComponents(['MyGlobalComponent1', 'MyGlobalComponent2'])
```

::callout
On server, `preloadComponents` will have no effect.
::
