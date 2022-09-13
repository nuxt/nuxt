---
icon: LogoNetlify
---

# Netlify

How to deploy Nuxt to [Netlify](https://www.netlify.com/).

::list

- Support for serverless SSR using Netlify Functions and Edge
- Auto-detected when deploying
- No configuration required

::

## Setup

Normally, the deployment to Netlify does not require any configuration. Nuxt will auto-detect that you are in a [Netlify](https://www.netlify.com) build environment and build the correct version of your Nuxt server. For new sites, Netlify will detect that you are using Nuxt and set the publish directory to `dist` and build command to `npm run build`. If you are upgrading an existing site, you should check these and update them if needed.

To trigger a deploy, just push to your git repository [as you would normally do for Netlify](https://docs.netlify.com/configure-builds/get-started/).

By default, Nuxt will server-render each page on server hit using [Netlify Functions](https://docs.netlify.com/functions/overview/). You can optionally configure deployment to use [Netlify Edge Functions](https://docs.netlify.com/netlify-labs/experimental-features/edge-functions/) or [Netlify On-demand Builders](https://docs.netlify.com/configure-builds/on-demand-builders/).

## Netlify Edge Functions

[Netlify Edge Functions](https://docs.netlify.com/netlify-labs/experimental-features/edge-functions/) use [Deno](https://deno.land) and the powerful V8 JavaScript runtime to let you run globally distributed functions for the fastest possible response times. Nuxt output can directly run the server at the edge - closer to your users!

Read more in the [Netlify Edge Functions announcement](https://www.netlify.com/blog/announcing-serverless-compute-with-edge-functions).

## On-demand Builders

[Netlify On-demand Builders](https://docs.netlify.com/configure-builds/on-demand-builders/) are serverless functions used to generate web content as needed that’s automatically cached on Netlify’s Edge CDN. They enable you to build pages for your site when a user visits them for the first time and then cache them at the edge for subsequent visits (also known as Incremental Static Regeneration).

## Custom Redirects

If you want to add custom redirects, you can do so by adding a [`_redirects`](https://docs.netlify.com/routing/redirects/#syntax-for-the-redirects-file) file in the [`public`](/guide/directory-structure/public) directory.

## Learn More

:ReadMore{link="https://nitro.unjs.io/deploy/providers/netlify" title="the Nitro documentation for Netlify deployment"}
