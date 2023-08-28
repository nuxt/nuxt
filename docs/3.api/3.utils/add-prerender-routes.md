---
description: addPrerenderRoutes hints to Nitro to prerender an additional route.
---

# `addPrerenderRoutes`

When prerendering, you can hint to Nitro to prerender additional paths, even if their URLs do not show up in the HTML of the generated page.

`addPrerenderRoutes` can only be called within component setup functions, plugins, and route middleware.

```js
const route = useRoute()

addPrerenderRoutes('/')
```

::alert{icon=👉}
In the browser, or if called outside prerendering, `addPrerenderRoutes` will have no effect.
::
