---
description: prerenderPath hints to Nitro to prerender an additional route.
---
# `prerenderPath`

When prerendering, you can hint to Nitro to prerender additional paths, even if their URLs do not show up in the HTML of the generated page.

`prerenderPath` can only be called within component setup functions, plugins, and route middleware.

```js
const route = useRoute()

prerenderPath('/')
```

::alert{icon=👉}
In the browser, or if called outside prerendering, `prerenderPath` will have no effect.
::
