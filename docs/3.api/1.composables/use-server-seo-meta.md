---
description: The useServerSeoMeta composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.
---

# `useServerSeoMeta`

Just like [`useSeoMeta`](/docs/api/composables/use-seo-meta), `useServerSeoMeta` composable lets you define your site's SEO meta tags as a flat object with full TypeScript support.
:ReadMore{link="/docs/api/composables/use-seo-meta"}

In most instances, the meta doesn't need to be reactive as robots will only scan the initial load. So we recommend using `useServerSeoMeta` as a performance-focused utility that will not do anything (or return a `head` object) on the client.
Parameters are exactly the same as with [`useSeoMeta`](/docs/api/composables/use-seo-meta)
