---
title: 'defineRouteRules'
description: 'Define route rules for hybrid rendering at the page level.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/pages/runtime/composables.ts
    size: xs
---

::read-more{to="/docs/guide/going-further/experimental-features#inlinerouterules" icon="i-ph-star-duotone"}
This feature is experimental and in order to use it you must enable the `experimental.inlineRouteRules` option in your `nuxt.config`.
::

## Usage

```vue [pages/index.vue]
<script setup>
defineRouteRules({
  prerender: true
})
</script>

<template>
  <h1>Hello world!</h1>
</template>
```

Will be translated to:

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }
  }
})
```

::callout
When running [`nuxt build`](/docs/api/commands/build), the home page will be pre-rendered in `.output/public/index.html` and statically served.
::

## Notes

- A rule defined in `~/pages/foo/bar.vue` will be applied to `/foo/bar` requests.
- A rule in `~/pages/foo/[id].vue` will be applied to `/foo/**` requests.

For more control, such as if you are using a custom `path` or `alias` set in the page's [`definePageMeta`](/docs/api/utils/define-page-meta), you should set `routeRules` directly within your `nuxt.config`.

::read-more{to="/docs/guide/concepts/rendering#hybrid-rendering" icon="i-ph-medal-duotone"}
Read more about the `routeRules`.
::
