---
description: The useSeoMeta composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.
---

# `useSeoMeta`

The `useSeoMeta` composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.

This helps you avoid common mistakes, such as using `name` instead of `property`, as well as typos - with over 100+ meta tags fully typed.

This is the recommended way to add meta tags to your site as it is XSS safe and has full TypeScript support.
:ReadMore{link="/docs/getting-started/seo-meta"}

## Example

```vue [app.vue]
<script setup lang="ts">
useSeoMeta({
  title: 'My Amazing Site',
  ogTitle: 'My Amazing Site',
  description: 'This is my amazing site, let me tell you all about it.',
  ogDescription: 'This is my amazing site, let me tell you all about it.',
  ogImage: 'https://example.com/image.png',
  twitterCard: 'summary_large_image',
})
</script>
```

When inserting tags that are reactive, you should use the computed getter syntax (`() => value`):

```vue [app.vue]
<script setup lang="ts">
const title = ref('My title')

useSeoMeta({
  title,
  description: () => `description: ${title.value}`
})
</script>
```

## Parameters

There are over 100+ parameters.

Full list of [`parameters`](https://github.com/harlan-zw/zhead/blob/main/src/metaFlat.ts)

# `useServerSeoMeta`

In most instances, the meta doesn't need to be reactive as robots will only scan the initial load. So we recommend using `useServerSeoMeta` as a performance-focused utility that will not do anything (or return a `head` object) on the client.
Parameters are exactly the same as with `useSeoMeta`

Read more on the [`useSeoMeta`](https://unhead.harlanzw.com/guide/composables/use-seo-meta) and [`useServerSeoMeta`](https://unhead.harlanzw.com/guide/composables/use-seo-meta#useserverseometa) composable.
