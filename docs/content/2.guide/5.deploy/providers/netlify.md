---
icon: LogoNetlify
---

# Netlify

How to deploy Nuxt to [Netlify](https://www.netlify.com/).

::list

- Support for serverless SSR build
- Auto-detected when deploying
- No configuration required
::

## Setup

Nitro will auto-detect that you are in a [Netlify](https://www.netlify.com) environment and build the correct version of your Nuxt server. For new sites, Netlify will detect that you are using Nuxt 3 or bridge and set the publish directory to `dist` and build command to `npm run build`. If you are upgrading an existing site you should check these and update them if needed.

Normally, the deployment to Netlify does not require any configuration.
However, if you want to add custom redirects, you can do so by adding a [`_redirects`](https://docs.netlify.com/routing/redirects/#syntax-for-the-redirects-file) file in the [`public`](/guide/directory-structure/public) directory.

## Deployment

Just push to your git repository [as you would normally do for Netlify](https://docs.netlify.com/configure-builds/get-started/).

## Deploy to Netlify Edge

By setting `NITRO_PRESET` environement variable to `netlify_edge` you can use [Netlify Edge Functions](https://docs.netlify.com/netlify-labs/experimental-features/edge-functions/) to render Nuxt app!

## Learn more

:ReadMore{link="https://nitro.unjs.io/deploy/providers/netlify.html" title="the Nitro documentation for Netlify deployment"}
