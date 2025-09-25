---
navigation.title: 'Nuxt Performance'
title: Nuxt performance
description: Best practices for improving performance of Nuxt apps.
---

Nuxt comes with built-in features designed to improve your application's performance and contribute to better [Core Web Vitals](https://web.dev/articles/vitals). There are also multiple Nuxt core modules that assist in improving performance in specific areas. This guide outlines best practices to optimize performance of your Nuxt application.

## Built-in Features

Nuxt offers several built-in features that help you optimize performance of your website. Understanding how these features work is crucial for achieving blazingly-fast performance.

### Links

[`<NuxtLink>`](/docs/4.x/api/components/nuxt-link) is a drop-in replacement for both Vue Router's `<RouterLink>` component and HTML's `<a>` tag. It intelligently determines whether the link is internal or external and renders it accordingly with available optimizations (prefetching, default attributes, etc.)

```html
<template>
  <NuxtLink to="/about">About page</NuxtLink>
</template>

<!-- Which will render to with Vue Router & Smart Prefetching -->
<a href="/about">About page</a>
```

Nuxt automatically includes smart prefetching. That means it detects when a link is visible (by default), either in the viewport or when scrolling and prefetches the JavaScript for those pages so that they are ready when the user clicks the link.

You can also opt for prefetching on interaction instead:

```ts
export default defineNuxtConfig({
  experimental: {
    defaults: {
      nuxtLink: {
        prefetchOn: 'interaction',
      },
    }
  }
})
```

:read-more{title="NuxtLink" to="/docs/api/components/nuxt-link"}

### Hybrid Rendering

In more complex applications, we may need a full control over how our application is rendered to support cases where some pages could be generated at build time, while others should be client-side rendered

Hybrid rendering allows different caching rules per route using Route Rules and decides how the server should respond to a new request on a given URL:

```ts
export default defineNuxtConfig({
  routeRules: {
    '/': {
      prerender: true
    },
    '/products/**': {
      swr: 3600
    },
    '/blog': {
      isr: 3600
    },
    '/admin/**': {
      ssr: false
    },
  }
})
```

Nuxt server will automatically register corresponding middleware and wrap routes with cache handlers using Nitro caching layer.

:read-more{title="Hybrid rendering" to="/docs/guide/concepts/rendering#hybrid-rendering"}

### Lazy Loading Components

To dynamically import a component (also known as lazy-loading a component) all you need to do is add the Lazy prefix to the component's name. This is useful if the component is not always needed.

```html
<script setup lang="ts">
const show = ref(false)
</script>

<template>
  <div>
    <h1>Mountains</h1>
    <LazyMountainsList v-if="show" />
    <button v-if="!show" @click="show = true">Show List</button>
  </div>
</template>
```

By using the Lazy prefix you can delay loading the component code until the right moment, which can be helpful for optimizing your JavaScript bundle size.

:read-more{title="Lazy loading components" to="/docs/guide/directory-structure/app/components#dynamic-imports"}

### Lazy Hydration

It is not always necessary to hydrate (or make interactive) all the components of your site on the initial load. Using lazy hydration, you can control when components can have their code loaded, which can improve the time-to-interactive metric for your app. Nuxt allows you to control when components become interactive with lazy hydration (added in Nuxt v3.16).

```html
<template>
  <div>
    <LazyMyComponent hydrate-on-visible />
  </div>
</template>
```

To optimize your app, you may want to delay the hydration of some components until they're visible, or until the browser is done with more important tasks.

:read-more{title="Lazy hydration" to="/docs/guide/directory-structure/app/components#delayed-or-lazy-hydration"}

### Fetching data

To avoid fetching same data twice (once on the server and once on client) Nuxt provides [`useFetch`](/docs/4.x/api/composables/use-fetch) and [`useAsyncData`](/docs/4.x/api/composables/use-async-data). They ensure that if an API call is made on the server, the data is forwarded to the client in the payload instead of being fetched again.

:read-more{title="Data fetching" to="/docs/getting-started/data-fetching"}

## Core Nuxt Modules

Apart from Nuxt's built-in features, there are also core modules maintained by the Nuxt team which help improve performance even further. These modules help handle assets such as images, custom fonts, or third party scripts.

### Images

Unoptimized images can have a significant negative impact on your website performance, specifically the [Largest Contentful Paint (LCP)](https://web.dev/articles/lcp) score.

In Nuxt we can use [Nuxt Image](https://image.nuxt.com/) module that is a plug-and-play image optimization for Nuxt apps. It allows resizing and transforming your images using built-in optimizer or your favorite images CDN.

:video-accordion{title="Watch the video by LearnVue about Nuxt Image" videoId="_UBff2eqGY0"}

[`<NuxtImg>`](/docs/4.x/api/components/nuxt-img) is a drop-in replacement for the native `<img>` tag that comes with following enhancements:

* Uses built-in provider to optimize local and remote images
* Converts `src` to provider optimized URLs with modern formats such as WebP or Avif
* Automatically resizes images based on `width` and `height`
* Generates responsive `sizes` when providing sizes option
* Supports native `lazy loading` as well as other `<img>` attributes

Images in your website can usually be separated by importance; the ones that are needed to be delivered first at initial load (i.e. `Largest Contentful Paint`), and the ones that can be loaded later or when specifically needed. For that, we could use the following optimizations:

```html
<template>
  <!-- 🚨 Needs to be loaded ASAP -->
  <NuxtImg
    src="/hero-banner.jpg"
    format="webp"
    preload
    loading="eager"
    fetch-priority="high"
    width="200"
    height="100"
  />

  <!-- 🐌 Can be loaded later -->
  <NuxtImg
    src="/facebook-logo.jpg"
    format="webp"
    loading="lazy"
    fetch-priority="low"
    width="200"
    height="100"
  />
</template>
```

:read-more{title="Nuxt Image" to="https://image.nuxt.com/usage/nuxt-img"}

### Fonts

[Nuxt Fonts](https://fonts.nuxt.com/) will automatically optimize your fonts (including custom fonts) and remove external network requests for improved privacy and performance.

It includes built-in automatic self-hosting for any font file which means you can optimally load web fonts with reduced layout shift, thanks to the underlying package [fontaine](https://github.com/unjs/fontaine).

:video-accordion{title="Watch the talk by Daniel Roe about the idea behind Nuxt Fonts" videoId="D3F683UViBY"}

Nuxt Fonts processes all your CSS and does the following things automatically when it encounters a font-family declaration.

1. **Resolves fonts** – Looks for font files in public/, then checks web providers like Google, Bunny, and Fontshare.
2. **Generates @font-face rules** – Injects CSS rules to load fonts from the correct sources.
3. **Proxies & caches fonts** – Rewrites URLs to `/_fonts`, downloads and caches fonts locally.
4. **Creates fallback metrics** – Adjusts local system fonts to match web fonts, reducing layout shift ([CLS](https://web.dev/articles/cls)).
5. **Includes fonts in build** – Bundles fonts with your project, hashing file names and setting long-lived cache headers.

It supports multiple providers that are designed to be pluggable and extensible, so no matter your setup you should be able to use an existing provider or write your own.

### Scripts

Third-party resources like analytics tools, video embeds, maps, and social media integrations enhance website functionality but can significantly degrade user experience and negatively impact [Interaction to Next Paint (INP)](https://web.dev/articles/inp) and Largest Contentful Paint (LCP) scores.

[Nuxt Scripts](https://scripts.nuxt.com/) lets you load third-party scripts with better performance, privacy, security and DX.

:video-accordion{title="Watch the video by Alex Lichter about Nuxt Scripts" videoId="sjMqUUvH9AE"}

Nuxt Scripts provides an abstraction layer on top of third-party scripts, providing SSR support and type-safety and while still giving you full low-level control over how a script is loaded.

```ts
const { onLoaded, proxy } = useScriptGoogleAnalytics(
  { 
    id: 'G-1234567',
    scriptOptions: {
      trigger: 'manual',
    },
  },
)
// queue events to be sent when ga loads
proxy.gtag('config', 'UA-123456789-1')
// or wait until ga is loaded
onLoaded((gtag) => {
  // script loaded
})
```

:read-more{title="Nuxt Scripts" to="https://scripts.nuxt.com/scripts"}

## Profiling Tools

To improve performance, we need to first know how to measure it, starting with measuring performance during development - on local environment, and then moving to auditing application that are deployed on production.

### Nuxi Analyze

[This](/docs/4.x/api/commands/analyze) command of `nuxi` allows to analyze the production bundle or your Nuxt application. It leverages `vite-bundle-visualizer` (similar to `webpack-bundle-analyzer`) to generate a visual representation of your application's bundle, making it easier to identify which components take up the most space.

When you see a large block in the visualization, it often signals an opportunity for optimization—whether by splitting it into smaller parts, implementing lazy loading, or replacing it with a more efficient alternative, especially for third-party libraries.

Large blocks containing multiple elements can often be reduced by importing only the necessary components rather than entire modules while large standalone blocks may be better suited for lazy loading rather than being included in the main bundle.

### Nuxt DevTools

The [Nuxt DevTools](https://devtools.nuxt.com/) gives you insights and transparency about your Nuxt App to identify performance gaps and seamlessly manage your app configurations.

![Nuxt DevTools example](https://user-images.githubusercontent.com/11247099/217670806-fb39aeff-3881-44e5-b9c8-6c757f5925fc.png)

It comes with several features we can use to measure performance of Nuxt apps:
1. **Timeline** – Tracks time spent on rendering, updating, and initializing components to identify performance bottlenecks.  
2. **Assets** – Displays file sizes (e.g., images) without transformations.  
3. **Render Tree** – Shows connections between Vue components, scripts, and styles to optimize dynamic loading.  
4. **Inspect** – Lists all files used in the Vue app with their size and evaluation time.

### Chrome DevTools

Chrome DevTools come with two useful tabs for measuring performance; `Performance` and `Lighthouse`.

When you open the [Performance](https://developer.chrome.com/docs/devtools/performance/overview) panel, it instantly shows your local **Largest Contentful Paint (LCP)** and **Cumulative Layout Shift (CLS)** scores (good, needs improvement, or bad).  

If you interact with the page, it also captures **Interaction to Next Paint (INP)**, giving you a full view of your Core Web Vitals based on your device and network.

![Chrome DevTools Performance Panel](https://developer.chrome.com/static/docs/devtools/performance/image/cpu-throttling_856.png)

[Lighthouse](https://developer.chrome.com/docs/devtools/lighthouse) audits performance, accessibility, SEO, progressive web apps, and best practices. It runs tests on your page and generates a report. Use failing audits as a guide to improve your site.

![Lighthouse](https://developer.chrome.com/static/docs/lighthouse/images/lighthouse-overview_720.png)

Each audit has a reference document explaining why the audit is important, as well as how to fix it.

### PageSpeed Insights

[PageSpeed Insights (PSI)](https://developers.google.com/speed/docs/insights/v5/about) reports on the user experience of a page on both mobile and desktop devices, and provides suggestions on how that page may be improved.

It provides both lab and field data about a page. Lab data is useful for debugging issues, as it is collected in a controlled environment while field data is useful for capturing true, real-world user experience.

### Web Page Test

[WebPageTest](https://www.webpagetest.org/) is a web performance tool providing deep diagnostic information about how a page performs under a variety of conditions.

Each test can be run from different locations around the world, on real browsers, over any number of customizable network conditions.

## Common problems

When building more complex Nuxt applications, you will probably encounter some of the problems listed below. Understanding these problems and fixing them will help you improve performance of your website.

### Overusing plugins

**Problem**: A large number of plugins can cause performance issues, especially if they require expensive computations or take too long to initialize. Since plugins run during the hydration phase, inefficient setups can block rendering and degrade the user experience.

**Solution**: Inspect your plugins and see if some of them could be implemented rather as a composable or utility function instead.

### Unused code / dependencies

**Problem**: With the development of the project, there can be a case where there will be some unused code or a dependency. This additional functionality may not be used or needed while it will be increase the bundle size of our project.

**Solution**: Inspect your `package.json` for unused dependencies and analyze your code for unused utils/composables/functions.

### Not using Vue Performance tips

**Problem**: [Vue documentation](https://vuejs.org/guide/best-practices/performance) lists several Performance improvements we can use in our Nuxt projects as well but as they are part of Vue documentation, developers tend to forget about it and focus on Nuxt specific improvements only - while Nuxt application is still a Vue project.

**Solution**: Use concepts such as `shallowRef`, `v-memo`, `v-once`, etc to improve performance.

### Not following patterns

**Problem**: The more people are currently working on the project, the more difficult it will be to maintain the stable codebase. Developers have a tendency to introduce new concepts they've seen in another project which can cause conflicts and problems with performance.

**Solution**: Establish rules and patterns in the project such as [Good practices and Design Patterns for Vue Composables](https://dev.to/jacobandrewsky/good-practices-and-design-patterns-for-vue-composables-24lk)

### Trying to load everything at the same time

**Problem**: When a page is loaded and it is not correctly instructed about the order of loading elements it will result in fetching everything at the same time - which can be slow and result in bad User Experience.

**Solution**: Use concepts such as Progressive Enhancement where core webpage content is set first, then more nuanced and technically rigorous layers of presentation and features are added on top as the browser/internet connection allow.

## Useful Resources

To learn more about various techniques for improving performance, take a look at the following resources:

1. [Apply instant loading with the PRPL pattern](https://web.dev/articles/apply-instant-loading-with-prpl)
2. [Perceived performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Perceived_performance)
3. [Understanding Critical Rendering Path](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path)
