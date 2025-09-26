---
title: 'useServerSeoMeta'
description: The useServerSeoMeta composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

Just like [`useSeoMeta`](/docs/4.x/api/composables/use-seo-meta), `useServerSeoMeta` composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.

:read-more{to="/docs/4.x/api/composables/use-seo-meta"}

In most instances, the meta doesn't need to be reactive as robots will only scan the initial load. So we recommend using [`useServerSeoMeta`](/docs/4.x/api/composables/use-server-seo-meta) as a performance-focused utility that will not do anything (or return a `head` object) on the client.

```vue [app/app.vue]
<script setup lang="ts">
useServerSeoMeta({
  robots: 'index, follow'
})
</script>
```

Parameters are exactly the same as with [`useSeoMeta`](/docs/4.x/api/composables/use-seo-meta)

:read-more{to="/docs/4.x/getting-started/seo-meta"}
