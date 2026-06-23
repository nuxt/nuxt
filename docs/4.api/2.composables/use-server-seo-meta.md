---
title: 'useServerSeoMeta'
description: The useServerSeoMeta composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

::warning
`useServerSeoMeta` is deprecated. Wrap [`useSeoMeta`](/docs/4.x/api/composables/use-seo-meta) in an `if (import.meta.server)` block instead. The auto-import is removed under `future.compatibilityVersion: 5`.
::

`useServerSeoMeta` lets you define your site's SEO meta tags as a flat object with full TypeScript support, exactly like [`useSeoMeta`](/docs/4.x/api/composables/use-seo-meta), but it only runs server-side and is tree-shaken from the client bundle.

:read-more{to="/docs/4.x/api/composables/use-seo-meta"}

For new code, use the server-only pattern directly:

```vue [app/app.vue]
<script setup lang="ts">
if (import.meta.server) {
  useSeoMeta({
    robots: 'index, follow',
  })
}
</script>
```

Parameters are exactly the same as with [`useSeoMeta`](/docs/4.x/api/composables/use-seo-meta).

:read-more{to="/docs/4.x/getting-started/seo-meta"}
