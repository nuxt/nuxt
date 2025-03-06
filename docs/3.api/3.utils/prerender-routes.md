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

::important
`prerenderRoutes` can only be called within the [Nuxt context](/docs/guide/going-further/nuxt-app#the-nuxt-context).
::

::note
`prerenderRoutes` has to be executed during prerendering. If the `prerenderRoutes` is used in dynamic pages/routes which are not prerendered, then it will not be executed.
::

```js
const route = useRoute()

prerenderRoutes('/')
prerenderRoutes(['/', '/about'])
```

::note
In the browser, or if called outside prerendering, `prerenderRoutes` will have no effect.
::

You can even prerender API routes which is particularly useful for full Statically Generated Sites (SSG) because you can then `$fetch` data as if you have an available server!

```js
prerenderRoutes('/api/content/article/name-of-article');

// Somewhere later in App
const articleContent = await $fetch('/api/content/article/name-of-article', {
  responseType: 'json',
});
```

::warning
Fetching prerendered API routes on production looses all headers you set up in `defineEventHandler` on server side! This means the data you fetch will most likely have `application/octet-stream` content type even if it is just a JSON and therefore break the application in unpredictable ways.
Always manually set `responseType` when fetching prerenderered API routes!
::
