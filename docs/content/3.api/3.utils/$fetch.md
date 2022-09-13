# `$fetch`

::ReadMore{link="/getting-started/data-fetching"}
::

Nuxt uses [ohmyfetch](https://github.com/unjs/ohmyfetch) to expose globally the `$fetch` helper for making HTTP requests within your Vue app or API routes.

During server-side rendering, calling `$fetch` to fetch your internal [API routes](/guide/directory-structure/server) will directly call the relevant function (emulating the request), **saving an additional API call**.

Note that `$fetch` is the preferred way to make HTTP calls in Nuxt 3 instead of [@nuxt/http](https://github.com/nuxt/http) and [@nuxtjs/axios](https://github.com/nuxt-community/axios-module) that are made for Nuxt 2.

::NeedContribution
::
