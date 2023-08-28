---
description: addPrerenderRoute hints to Nitro to prerender an additional route.
---
addPrerenderRoute
# `addPrerenderRoute`

When prerendering, you can hint to Nitro to prerender additional paths, even if their URLs do not show up in the HTML of the generated page.
addPrerenderRoute
`addPrerenderRoute` can only be called within component setup functions, plugins, and route middleware.

```js
const route = useRoute()
addPrerenderRoute
addPrerenderRoute('/')
```

::alert{icon=👉}addPrerenderRoute
In the browser, or if called outside prerendering, `addPrerenderRoute` will have no effect.
::
