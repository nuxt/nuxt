---
navigation.title: 'Accessibility'
title: Nuxt accessibility
description: Best practices for accessibility in Nuxt apps.
---

Most of what makes an app accessible is not specific to Nuxt: color contrast, form semantics, and ARIA work the same here as in any Vue or plain HTML application, and the [resources](#useful-resources) at the end of this guide cover them well.

What Nuxt does change is navigation. Once your app has hydrated, it routes on the client, so the document is never reloaded and the browser no longer announces a new page or resets focus for you. Nuxt ships with features that fill some of that gap, and a few conventions cover the rest. This guide outlines best practices for handling that.

::tip
[`@nuxt/a11y`](https://github.com/nuxt/a11y) surfaces accessibility problems in your components while you develop, alongside the practices below. It is in alpha, so expect its API to change.
::

## Route Announcements

Screen readers announce a full page load by themselves, but they have no way of knowing that a client-side navigation happened. [`<NuxtRouteAnnouncer>`](/docs/4.x/api/components/nuxt-route-announcer) solves this by rendering a hidden live region and writing the new page title into it after every navigation:

```vue [app.vue]
<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
```

The announcer reads the title that Unhead rendered, so it is only as useful as your titles are. If two routes share the same `<title>`, users hear nothing on the way between them.

When you need to announce something else, or to change how urgently it is announced, use [`useRouteAnnouncer`](/docs/4.x/api/composables/use-route-announcer):

```vue [app/pages/search.vue]
<script setup lang="ts">
const { set } = useRouteAnnouncer()
const { data: results } = await useFetch('/api/search')

watch(results, (results) => {
  set(`${results?.length ?? 0} results found`)
})
</script>
```

:read-more{title="NuxtRouteAnnouncer" to="/docs/4.x/api/components/nuxt-route-announcer"}

For in-page updates that are not navigations, such as form validation or toasts, use [`<NuxtAnnouncer>`](/docs/4.x/api/components/nuxt-announcer) with [`useAnnouncer`](/docs/4.x/api/composables/use-announcer) instead.

## Page Titles

Because the route announcer follows the document title, giving every route a distinct title is the single most valuable thing you can do. Set a global template in `app.vue` and let each page fill in its own part:

```vue [app.vue]
<script setup lang="ts">
useHead({
  titleTemplate: title => title ? `${title} - Nuxt` : 'Nuxt',
})
</script>
```

```vue [app/pages/about.vue]
<script setup lang="ts">
useHead({
  title: 'About us',
})
</script>
```

If your titles come from route metadata rather than from the page itself, you can read [`definePageMeta`](/docs/4.x/directory-structure/app/pages#page-metadata) values from [`useRoute`](/docs/4.x/api/composables/use-route) in a layout.

:read-more{title="SEO and Meta" to="/docs/4.x/getting-started/seo-meta#dynamic-title"}

## Links

Use [`<NuxtLink>`](/docs/4.x/api/components/nuxt-link) for in-app navigation. It renders a real `<a href="...">`, which means it is focusable, appears in the tab order, and works with middle-click and "open in new tab", all of which you would have to reimplement on a `<div>` with a `@click` handler calling `navigateTo`.

```vue
<template>
  <NuxtLink to="/about">About page</NuxtLink>
</template>
```

In a menu or a set of breadcrumbs, the link matching the current route already exposes `aria-current="page"`, so assistive technology can tell which item you are on. Where a different token describes the relationship better, such as a step in a multi-page form, set [`ariaCurrentValue`](/docs/4.x/api/components/nuxt-link#routerlink):

```vue
<template>
  <NuxtLink
    to="/checkout/payment"
    aria-current-value="step"
  >Payment</NuxtLink>
</template>
```

Links to files in your `public/` directory, or to another app on the same origin, are not routes that Vue Router knows about. Mark them as [`external`](/docs/4.x/api/components/nuxt-link#handling-static-file-and-cross-app-links) so the browser performs a real navigation instead of failing to match a route.

:read-more{title="NuxtLink" to="/docs/4.x/api/components/nuxt-link"}

## Focus Management

After a client-side navigation, focus stays where it was, which is usually the link the user just activated. Vue Router does not move it and neither does Nuxt, so a keyboard user can end up tabbing through the whole header again to reach the content that just changed.

A skip link as the first tab stop of your app is the conventional fix, and it helps on the initial page load too:

```vue [app.vue]
<template>
  <a
    class="skip-link"
    href="#main"
  >Skip to main content</a>
  <AppHeader />
  <main
    id="main"
    tabindex="-1"
  >
    <NuxtPage />
  </main>
</template>

<style>
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  position: static;
}
</style>
```

`<main>` is not focusable on its own, so it needs `tabindex="-1"` to accept focus from the skip link or from a script. Use `-1` rather than a positive value, which would move the element in the tab order and surprise everyone else.

If it suits your app, you can go further and move focus to the main region after every navigation from a plugin:

```ts [app/plugins/focus-main.client.ts]
export default defineNuxtPlugin(() => {
  useRouter().afterEach((to, from) => {
    if (to.path === from.path) {
      return
    }
    nextTick(() => document.getElementById('main')?.focus())
  })
})
```

::tip
Navigate around your app with the keyboard alone. Tabbing from the skip link into `<main>` after a couple of navigations will surface most focus problems quickly.
::

## Scroll Behavior

Nuxt scrolls to the top on a new route, restores the previous position when the user goes back, and scrolls to hash targets. If you need something different, such as smooth scrolling or a different offset, configure [`scrollBehaviorType`](/docs/4.x/guide/recipes/custom-routing#scroll-behavior-for-hash-links) or write your own `scrollBehavior` in [`router.options.ts`](/docs/4.x/guide/recipes/custom-routing#router-options). Bear in mind that smooth scrolling should respect the user's `prefers-reduced-motion` setting.

:read-more{title="Custom routing" to="/docs/4.x/guide/recipes/custom-routing"}

## Useful Resources

- [Web Accessibility Initiative (WAI)](https://www.w3.org/WAI/)
- [MDN: Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)
