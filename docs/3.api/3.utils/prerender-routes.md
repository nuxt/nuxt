---
title: 'prerenderRoutes'
description: prerenderRoutes hints to Nitro to prerender an additional route.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/ssr.ts
    size: xs
---

When prerendering, you can hint to Nitro to prerender additional paths, even if their URLs do not show up in the HTML of the generated page.

```js
const route = useRoute()

prerenderRoutes('/')
prerenderRoutes(['/', '/about'])
```

::callout
In the browser, or if called outside prerendering, `prerenderRoutes` will have no effect.
::
