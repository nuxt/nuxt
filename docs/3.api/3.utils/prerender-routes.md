---
description: prerenderRoutes hints to Nitro to prerender an additional route.
links:
  - label: Source Code
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

# `prerenderRoutes`

When prerendering, you can hint to Nitro to prerender additional paths, even if their URLs do not show up in the HTML of the generated page.

`prerenderRoutes` can only be called within component setup functions, plugins, and route middleware.

```js
const route = useRoute()

prerenderRoutes('/')
prerenderRoutes(['/', '/about'])
```

::alert{icon=👉}
In the browser, or if called outside prerendering, `prerenderRoutes` will have no effect.
::
