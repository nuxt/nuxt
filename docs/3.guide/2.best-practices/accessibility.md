---
navigation.title: Accessibility
title: Accessible routing and navigation
description: Patterns for navigation, route announcements, links, and focus in Nuxt apps.
---

In SPAs, changing the route does not reload the document, so keyboard and screen reader users depend on clear titles, landmarks, and real links. This guide covers **navigation in Nuxt**. Broader WCAG topics (color, forms, and similar) sit outside this page; use the references below as a starting point.

## Further reading

- [Web Accessibility Initiative (WAI)](https://www.w3.org/WAI/)
- [MDN: Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [Understanding WCAG 2](https://www.w3.org/WAI/WCAG21/Understanding/)

## Page titles

Set a **document title** that changes when the view changes.

- Use [`useHead`](/docs/4.x/api/composables/use-head) and, where it helps, [`titleTemplate`](/docs/4.x/getting-started/seo-meta#dynamic-title) in [`app.vue`](/docs/4.x/directory-structure/app/app).
- Store per-route data in [`definePageMeta`](/docs/4.x/directory-structure/app/pages#page-metadata) (for example `title`) and read it from [`useRoute`](/docs/4.x/api/composables/use-route) in a layout to build the final `<title>`.

The route announcer in the next section reacts when that title updates (through Unhead). If the title string does not change between navigations, users may not hear that the page changed.

## Route announcements

1. Add [`<NuxtRouteAnnouncer>`](/docs/4.x/api/components/nuxt-route-announcer) in `app.vue` or the root layout (Nuxt v3.12+).
2. Keep the document title aligned with the active route.
3. Use [`useRouteAnnouncer`](/docs/4.x/api/composables/use-route-announcer) when you need a custom announcement or to control `politeness` (`polite`, `assertive`, or `off`).

For updates that are not route changes (validation, toasts, loading copy), use [`<NuxtAnnouncer>`](/docs/4.x/api/components/nuxt-announcer) with [`useAnnouncer`](/docs/4.x/api/composables/use-announcer).

::read-more{to="/docs/4.x/api/components/nuxt-route-announcer"}
::

## Links and `<NuxtLink>`

Use [`<NuxtLink>`](/docs/4.x/api/components/nuxt-link) or [`<RouterLink>`](https://router.vuejs.org/guide/) for in-app navigation, so the DOM keeps a normal `<a href="...">` and tab order.

Avoid using `@click` on a `div` (or similar) plus `navigateTo` as a stand-in for a link unless you add `role`, keyboard handling, and focus styles yourself. [`<NuxtLink>`](/docs/4.x/api/components/nuxt-link) already does the right thing.

For external URLs, `<NuxtLink>` applies `rel` and `target` where appropriate. Use [`external`](/docs/4.x/api/components/nuxt-link#handling-static-file-and-cross-app-links) for files under `/public` or another app on the same origin, so the browser handles navigation outside Vue Router.

### Active item

Vue Router’s [`ariaCurrentValue`](https://router.vuejs.org/api/interfaces/routerlinkprops#ariaCurrentValue-) is supported on internal [`<NuxtLink>`](/docs/4.x/api/components/nuxt-link#routerlink). Set it when the active row in nav or breadcrumbs should expose `aria-current`.

## Focus

After client navigation, focus typically remains on the element that triggered the change. That is expected for Vue Router; Nuxt does not move focus for you.

- Wrap primary content in a single [`<main>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/main) with a stable `id`.
- Put a skip link at the top of [`app.vue`](/docs/4.x/directory-structure/app/app) (first tab stop) that sends focus into `#main`.
- Optional: in a [client plugin](/docs/4.x/directory-structure/app/plugins), register `router.afterEach` and call `focus()` on the main region when that fits your UX. Non-tabbable elements need `tabindex="-1"` for programmatic focus; do not break the tab order for sequential keyboard users.

::tip
After a few navigations, tab from the skip link through the nav into `<main>` and confirm focus behaves as you expect.
::

## Scroll

[`scrollBehaviorType`](/docs/4.x/guide/recipes/custom-routing#router-options) and [`router.options.ts`](/docs/4.x/guide/recipes/custom-routing#router-options) configure scroll on navigation (for example smooth scrolling to a hash).

::read-more{to="/docs/4.x/guide/recipes/custom-routing"}
::

## `nuxt/a11y` module

The [`nuxt/a11y`](https://github.com/nuxt/a11y) module adds more helpers on top of core APIs. Nuxt already includes [`<NuxtRouteAnnouncer>`](/docs/4.x/api/components/nuxt-route-announcer) and related composables, so the module is optional.
