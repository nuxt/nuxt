/**
 * Nuxt runtime error codes.
 *
 * Each code maps to a docs page at `https://nuxt.com/docs/errors/{code}`.
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

// ---------- E1xxx: Core / instance ----------
/** A composable was called outside of a valid Nuxt context */
export const E1001 = 'E1001'
/** Client-side runtime config key not available */
export const E1003 = 'E1003'

// ---------- E2xxx: Navigation / routing ----------
/** Navigating to an external URL without `external: true` */
export const E2001 = 'E2001'
/** Navigation to URL with dangerous protocol */
export const E2002 = 'E2002'
/** `abortNavigation()` called outside middleware */
export const E2003 = 'E2003'
/** Unknown route middleware */
export const E2004 = 'E2004'
/** `useRoute` called within middleware (misleading results) */
export const E2005 = 'E2005'
/** No middleware passed to `addRouteMiddleware` */
export const E2006 = 'E2006'
/** `setPageLayout` called on server within component */
export const E2007 = 'E2007'
/** `setPageLayout` called during hydration */
export const E2008 = 'E2008'
/** No error handlers for middleware errors */
export const E2009 = 'E2009'
/** Failed to prefetch link */
export const E2010 = 'E2010'
/** Failed to preload route component */
export const E2011 = 'E2011'

// ---------- E3xxx: Data fetching ----------
/** `useFetch` URL starts with "//" */
export const E3001 = 'E3001'
/** `useFetch` failed to hash body */
export const E3002 = 'E3002'
/** Component already mounted — use `$fetch` instead */
export const E3003 = 'E3003'
/** Incompatible `useAsyncData` options */
export const E3004 = 'E3004'
/** Do not pass `execute` directly to `watch` */
export const E3005 = 'E3005'
/** `useAsyncData` handler returned `undefined` */
export const E3006 = 'E3006'
/** asyncData should return an object */
export const E3007 = 'E3007'

// ---------- E4xxx: Components / layouts ----------
/** Invalid layout selected */
export const E4001 = 'E4001'
/** Layout does not have single root node */
export const E4002 = 'E4002'
/** `<NuxtLayout>` needs single root node in slot */
export const E4003 = 'E4003'
/** Page does not have single root node */
export const E4004 = 'E4004'
/** Server component must have single root element */
export const E4005 = 'E4005'
/** SSR fallback in `<NuxtClientFallback>` */
export const E4006 = 'E4006'
/** Layouts exist but `<NuxtLayout>` not used */
export const E4007 = 'E4007'
/** Cannot access path outside project root (test wrapper) */
export const E4008 = 'E4008'
/** Nested `<a>` tags inside `<NuxtLink>` */
export const E4009 = 'E4009'
/** `<NuxtLink>` conflicting props */
export const E4010 = 'E4010'
/** Pages exist but `<NuxtPage>` not used */
export const E4011 = 'E4011'
/** Island component error */
export const E4012 = 'E4012'
/** v-for range expects integer */
export const E4013 = 'E4013'
/** No pages directory found (placeholder) */
export const E4014 = 'E4014'

// ---------- E5xxx: Configuration / manifest ----------
/** App manifest not enabled */
export const E5001 = 'E5001'
/** Error fetching app manifest */
export const E5002 = 'E5002'
/** Error matching route rules */
export const E5003 = 'E5003'
/** Setting response headers not supported in browser */
export const E5004 = 'E5004'

// ---------- E6xxx: Head / SEO ----------
/** Missing Unhead instance */
export const E6001 = 'E6001'
/** `<Title>` slot must be a single string */
export const E6002 = 'E6002'
/** `<Style>` slot must be a string */
export const E6003 = 'E6003'

// ---------- E7xxx: Payload / serialization ----------
/** Payload URL must not include hostname */
export const E7001 = 'E7001'
/** Cannot load payload */
export const E7002 = 'E7002'
/** Error preloading payload */
export const E7003 = 'E7003'
/** `definePayloadReviver` called in wrong context */
export const E7004 = 'E7004'
/** Cookie already expired */
export const E7005 = 'E7005'
/** Cookie being overridden */
export const E7006 = 'E7006'
/** `useState` init must be a function */
export const E7007 = 'E7007'
/** `callOnce` fn must be a function */
export const E7008 = 'E7008'
/** `useState` key must be a string */
export const E7009 = 'E7009'
/** `callOnce` key must be a string */
export const E7010 = 'E7010'
/** `useAsyncData` key must be a string */
export const E7011 = 'E7011'
/** `useAsyncData` handler must be a function */
export const E7012 = 'E7012'

// ---------- E1xxx (continued) ----------
/** `setInterval` used on server */
export const E1004 = 'E1004'
/** Error during app initialization */
export const E1005 = 'E1005'
/** `onPrehydrate` not processed by build pipeline */
export const E1006 = 'E1006'
/** Compiler-hint helper called at runtime */
export const E1007 = 'E1007'
