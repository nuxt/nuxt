---
description: prerenderRoutes hints to Nitro to prerender an additional route.
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
