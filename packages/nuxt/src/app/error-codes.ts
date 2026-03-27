/**
 * Nuxt runtime error codes.
 *
 * Each code maps to a docs page at `https://nuxt.com/e/{code}`.
 * Codes are stable — once assigned they must not be reused or renumbered.
 *
 * Ranges:
 *   E1xxx  Core / instance
 *   E2xxx  Navigation / routing
 *   E3xxx  Data fetching (useAsyncData, useFetch)
 *   E4xxx  Components / layouts
 *   E5xxx  Configuration / manifest
 *   E6xxx  Head / SEO
 *   E7xxx  Payload / serialization
 */

import type { ErrorDefinition } from '../../../shared/src/log.ts'

// ---------- E1xxx: Core / instance ----------
/** A composable was called outside of a valid Nuxt context */
export const E1001: ErrorDefinition = {
  code: 'E1001',
  message: 'A composable that requires access to the Nuxt instance was called outside of a plugin, Nuxt hook, Nuxt middleware, or Vue setup function.',
  fix: 'Ensure the composable is called within a valid Nuxt context.',
}
/** Client-side runtime config key not available */
export const E1003: ErrorDefinition = {
  code: 'E1003',
  message: 'Could not find runtime config key `{key}` on the client side.',
  hint: 'Only keys within `runtimeConfig.public` are accessible on the client.',
}
/** `setInterval` used on server */
export const E1004: ErrorDefinition = {
  code: 'E1004',
  message: '`setInterval` was called on the server, which may cause memory leaks.',
  fix: 'Wrap in a client-only guard or use `onNuxtReady`.',
}
/** Error during app initialization */
export const E1005: ErrorDefinition = {
  code: 'E1005',
  message: 'Error during app initialization.',
}
/** `onPrehydrate` not processed by build pipeline */
export const E1006: ErrorDefinition = {
  code: 'E1006',
  message: '`onPrehydrate` was not processed by the build pipeline.',
}
/** Compiler-hint helper called at runtime */
export const E1007: ErrorDefinition = {
  code: 'E1007',
  message: '`{helper}` is a compiler hint and should not be called at runtime.',
}
/** Skipping render: a response was already set by middleware or a plugin. */
export const E1008: ErrorDefinition = {
  code: 'E1008',
  message: 'Skipping render: a response was already set by middleware or a plugin.',
}
/** Error in `vue:error` hook. */
export const E1009: ErrorDefinition = {
  code: 'E1009',
  message: 'Error in `vue:error` hook.',
}
/** Not rendering error page for bot */
export const E1010: ErrorDefinition = {
  code: 'E1010',
  message: 'Not rendering error page for bot.',
}
/** Error while mounting app. */
export const E1011: ErrorDefinition = {
  code: 'E1011',
  message: 'Error while mounting app.',
}
/** `vue:setup` callbacks must be synchronous */
export const E1012: ErrorDefinition = {
  code: 'E1012',
  message: '`vue:setup` callbacks must be synchronous.',
}

// ---------- E2xxx: Navigation / routing ----------
/** Navigating to an external URL without `external: true` */
export const E2001: ErrorDefinition = {
  code: 'E2001',
  message: 'Navigating to an external URL is not allowed by default.',
  fix: 'Use `navigateTo(url, { external: true })` to allow external navigation.',
}
/** Navigation to URL with dangerous protocol */
export const E2002: ErrorDefinition = {
  code: 'E2002',
  message: 'Navigation to URL with `{protocol}` protocol is blocked.',
}
/** `abortNavigation()` called outside middleware */
export const E2003: ErrorDefinition = {
  code: 'E2003',
  message: '`abortNavigation()` was called outside of a route middleware.',
}
/** Unknown route middleware */
export const E2004: ErrorDefinition = {
  code: 'E2004',
  message: 'Unknown route middleware: `{name}`.',
  hint: 'Ensure the middleware is registered using `addRouteMiddleware` or placed in the `middleware/` directory.',
}
/** `useRoute` called within middleware (misleading results) */
export const E2005: ErrorDefinition = {
  code: 'E2005',
  message: '`useRoute` within middleware may return a misleading result.',
  fix: 'Use the `to` and `from` arguments passed to the middleware instead.',
}
/** No middleware passed to `addRouteMiddleware` */
export const E2006: ErrorDefinition = {
  code: 'E2006',
  message: 'No middleware function passed to `addRouteMiddleware`.',
}
/** `setPageLayout` called on server within component */
export const E2007: ErrorDefinition = {
  code: 'E2007',
  message: '`setPageLayout` should not be called on the server within a component setup function.',
}
/** `setPageLayout` called during hydration */
export const E2008: ErrorDefinition = {
  code: 'E2008',
  message: '`setPageLayout` should not be called during hydration.',
}
/** No error handlers for middleware errors */
export const E2009: ErrorDefinition = {
  code: 'E2009',
  message: 'No error handlers available for middleware error.',
}
/** Failed to prefetch link */
export const E2010: ErrorDefinition = {
  code: 'E2010',
  message: 'Failed to prefetch component for link: {to}.',
}
/** Failed to preload route component */
export const E2011: ErrorDefinition = {
  code: 'E2011',
  message: 'Failed to preload route component: {component}.',
}

// ---------- E3xxx: Data fetching ----------
/** `useFetch` URL starts with "//" */
export const E3001: ErrorDefinition = {
  code: 'E3001',
  message: '`useFetch` URL should not start with `//`.',
  fix: 'Use a fully qualified URL or a path starting with `/`.',
}
/** `useFetch` failed to hash body */
export const E3002: ErrorDefinition = {
  code: 'E3002',
  message: 'Failed to hash `useFetch` request body.',
}
/** Component already mounted — use `$fetch` instead */
export const E3003: ErrorDefinition = {
  code: 'E3003',
  message: '`{composable}` should not be called after the component is already mounted.',
  fix: 'Use `$fetch` directly for data fetching after component mount.',
}
/** Incompatible `useAsyncData` options */
export const E3004: ErrorDefinition = {
  code: 'E3004',
  message: 'Incompatible `useAsyncData` options.',
}
/** Do not pass `execute` directly to `watch` */
export const E3005: ErrorDefinition = {
  code: 'E3005',
  message: 'Do not pass `execute` or `refresh` directly to `watch`.',
  fix: 'Use `() => execute()` or `() => refresh()` as the watcher callback.',
}
/** `useAsyncData` handler returned `undefined` */
export const E3006: ErrorDefinition = {
  code: 'E3006',
  message: '`useAsyncData` handler must not return `undefined`.',
}
/** asyncData should return an object */
export const E3007: ErrorDefinition = {
  code: 'E3007',
  message: '`asyncData` should return an object.',
}

// ---------- E4xxx: Components / layouts ----------
/** Invalid layout selected */
export const E4001: ErrorDefinition = {
  code: 'E4001',
  message: 'Invalid layout `{layout}` selected.',
}
/** Layout does not have single root node */
export const E4002: ErrorDefinition = {
  code: 'E4002',
  message: 'Layout `{layout}` does not have a single root node and will cause errors on page transitions.',
  fix: 'Wrap the layout content in a single `<div>` or `<template>` root.',
}
/** `<NuxtLayout>` needs single root node in slot */
export const E4003: ErrorDefinition = {
  code: 'E4003',
  message: '`<NuxtLayout>` needs a single root node in its default slot.',
}
/** Page does not have single root node */
export const E4004: ErrorDefinition = {
  code: 'E4004',
  message: 'Page `{page}` does not have a single root node and will cause errors on page transitions.',
  fix: 'Wrap the page content in a single `<div>` or `<template>` root.',
}
/** Server component must have single root element */
export const E4005: ErrorDefinition = {
  code: 'E4005',
  message: 'Server component must have a single root element.',
}
/** SSR fallback in `<NuxtClientFallback>` */
export const E4006: ErrorDefinition = {
  code: 'E4006',
  message: 'SSR error in `<NuxtClientFallback>`, rendering fallback content.',
}
/** Layouts exist but `<NuxtLayout>` not used */
export const E4007: ErrorDefinition = {
  code: 'E4007',
  message: 'Layouts are defined but `<NuxtLayout>` is not used in `app.vue`.',
  fix: 'Add `<NuxtLayout>` to your `app.vue` template.',
}
/** Cannot access path outside project root (test wrapper) */
export const E4008: ErrorDefinition = {
  code: 'E4008',
  message: 'Cannot access path `{path}` outside of the project root.',
}
/** Nested `<a>` tags inside `<NuxtLink>` */
export const E4009: ErrorDefinition = {
  code: 'E4009',
  message: 'Nested `<a>` tags inside `<NuxtLink>` are not allowed.',
}
/** `<NuxtLink>` conflicting props */
export const E4010: ErrorDefinition = {
  code: 'E4010',
  message: '`<NuxtLink>` has conflicting `to` and `href` props.',
}
/** Pages exist but `<NuxtPage>` not used */
export const E4011: ErrorDefinition = {
  code: 'E4011',
  message: 'Pages are defined but `<NuxtPage>` is not used in `app.vue`.',
  fix: 'Add `<NuxtPage>` to your `app.vue` template.',
}
/** Island component error */
export const E4012: ErrorDefinition = {
  code: 'E4012',
  message: 'Error rendering island component `{component}`.',
}
/** v-for range expects integer */
export const E4013: ErrorDefinition = {
  code: 'E4013',
  message: '`v-for` range expects an integer value.',
}
/** No pages directory found (placeholder) */
export const E4014: ErrorDefinition = {
  code: 'E4014',
  message: 'No pages directory found.',
}

// ---------- E5xxx: Configuration / manifest ----------
/** App manifest not enabled */
export const E5001: ErrorDefinition = {
  code: 'E5001',
  message: 'App manifest is not enabled.',
}
/** Error fetching app manifest */
export const E5002: ErrorDefinition = {
  code: 'E5002',
  message: 'Error fetching app manifest.',
}
/** Error matching route rules */
export const E5003: ErrorDefinition = {
  code: 'E5003',
  message: 'Error matching route rules for {path}.',
}
/** Setting response headers not supported in browser */
export const E5004: ErrorDefinition = {
  code: 'E5004',
  message: 'Setting response headers is not supported in the browser.',
}

// ---------- E6xxx: Head / SEO ----------
/** Missing Unhead instance */
export const E6001: ErrorDefinition = {
  code: 'E6001',
  message: 'Missing Unhead instance. Ensure `@unhead/vue` is installed and configured.',
}
/** `<Title>` slot must be a single string */
export const E6002: ErrorDefinition = {
  code: 'E6002',
  message: '`<Title>` component slot must contain a single text node.',
}
/** `<Style>` slot must be a string */
export const E6003: ErrorDefinition = {
  code: 'E6003',
  message: '`<Style>` component slot must contain a single text node.',
}

// ---------- E7xxx: Payload / serialization ----------
/** Payload URL must not include hostname */
export const E7001: ErrorDefinition = {
  code: 'E7001',
  message: 'Payload URL must not include a hostname.',
}
/** Cannot load payload */
export const E7002: ErrorDefinition = {
  code: 'E7002',
  message: 'Cannot load payload for {url}.',
}
/** Error preloading payload */
export const E7003: ErrorDefinition = {
  code: 'E7003',
  message: 'Error preloading payload for {url}.',
}
/** `definePayloadReviver` called in wrong context */
export const E7004: ErrorDefinition = {
  code: 'E7004',
  message: '`definePayloadReviver` was called in the wrong context.',
}
/** Cookie already expired */
export const E7005: ErrorDefinition = {
  code: 'E7005',
  message: 'Cookie `{name}` has already expired.',
}
/** Cookie being overridden */
export const E7006: ErrorDefinition = {
  code: 'E7006',
  message: 'Cookie `{name}` is being overridden.',
}
/** `useState` init must be a function */
export const E7007: ErrorDefinition = {
  code: 'E7007',
  message: '`useState` initial value must be a function: `useState(key, () => value)`.',
}
/** `callOnce` fn must be a function */
export const E7008: ErrorDefinition = {
  code: 'E7008',
  message: '`callOnce` second argument must be a function.',
}
/** `useState` key must be a string */
export const E7009: ErrorDefinition = {
  code: 'E7009',
  message: '`useState` key must be a string.',
}
/** `callOnce` key must be a string */
export const E7010: ErrorDefinition = {
  code: 'E7010',
  message: '`callOnce` key must be a string.',
}
/** `useAsyncData` key must be a string */
export const E7011: ErrorDefinition = {
  code: 'E7011',
  message: '`useAsyncData` key must be a string.',
}
/** `useAsyncData` handler must be a function */
export const E7012: ErrorDefinition = {
  code: 'E7012',
  message: '`useAsyncData` handler must be a function.',
}
