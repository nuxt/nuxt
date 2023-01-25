---
title: "$fetch"
description: Nuxt uses ofetch to expose globally the $fetch helper for making HTTP requests.
---

# `$fetch`

Nuxt uses [ofetch](https://github.com/unjs/ofetch) to expose globally the `$fetch` helper for making HTTP requests within your Vue app or API routes.

::ReadMore{link="/docs/getting-started/data-fetching"}
::

During server-side rendering, calling `$fetch` to fetch your internal [API routes](/docs/guide/directory-structure/server) will directly call the relevant function (emulating the request), **saving an additional API call**.

Note that `$fetch` is the preferred way to make HTTP calls in Nuxt 3 instead of [@nuxt/http](https://github.com/nuxt/http) and [@nuxtjs/axios](https://github.com/nuxt-community/axios-module) that are made for Nuxt 2.

::NeedContribution
::
