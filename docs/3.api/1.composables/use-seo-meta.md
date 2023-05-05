---
description: The useSeoMeta composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.
---

# `useSeoMeta`

The `useSeoMeta` composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.

That helps you avoid common mistakes, such as using `name` instead of `property` and typos - with over 100+ meta tags fully typed.

That is the recommended way to add meta tags to your site, as it is XSS-safe and has full TypeScript support.
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

When inserting reactive tags, you should use the computed getter syntax (`() => value`):

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

Complete list of [`parameters`](https://github.com/harlan-zw/zhead/blob/main/src/metaFlat.ts)
