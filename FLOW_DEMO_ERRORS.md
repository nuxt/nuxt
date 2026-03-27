# Flow Demo - Error Code Reference

> [!IMPORTANT]
> This shouldn't be read by the agent, that would be cheating

Each page/file in this demo triggers one or more Nuxt errors. This document maps files to error codes and explains what's wrong.

## Build-time: Startup warnings (non-fatal)

### `app/plugins/1.meta-a.ts` — B2001
**Error:** `Invalid plugin metadata: the second argument to defineNuxtPlugin must be an object literal, but got CallExpression.`
**Fix:** Pass an object literal as the second argument instead of a function call.

### `app/plugins/2.meta-b.ts` — B2002
**Error:** `Invalid plugin metadata: spread elements and computed keys are not supported in plugin options.`
**Fix:** Replace spread syntax with static properties in the metadata object.

### `app/plugins/3.meta-c.ts` — B2003
**Error:** `Invalid plugin metadata: dependsOn must be an array of string literals.`
**Fix:** Use string literals in the `dependsOn` array (e.g. `['my-plugin']`).

### `app/components/MyButton.vue` + `app/components/my-button.vue` — B3011
**Error:** `Two component files resolving to the same name MyButton`
**Fix:** Rename one file or adjust `components.dirs` prefix in `nuxt.config`.

## Build-time: Page transform errors (crash SSR)

### `app/pages/async-page.vue` — B4002
**Error:** `Await expressions are not supported in definePageMeta.`
**Fix:** Move the `await` outside of variables referenced in `definePageMeta`, or use a static value.

### `app/pages/settings.vue` — B4003
**Error:** `Multiple definePageMeta calls are not supported. Consolidate them into a single call.`
**Fix:** Merge both `definePageMeta()` calls into one.

## Build-time: Module error (crashes startup)

### `modules/custom-template.ts` — B1003
**Error:** `Invalid template. Templates must have either src or getContents.`
**Fix:** Add a `getContents` function or `src` path to the `addTemplate()` call.

## Runtime: Fatal Errors (throwError)

### `app/pages/delayed-redirect.vue` → E1001

**Error**: A composable was called outside of a valid Nuxt context

`navigateTo()` is called inside a `setTimeout` callback. By the time the timeout fires, the Nuxt/Vue setup context is lost, so `useNuxtApp()` (called internally) throws.

**Fix**: Use `navigateTo` synchronously or store the router reference during setup:
```ts
const router = useRouter()
setTimeout(() => { router.push('/') }, 2000)
```

---

### `app/pages/share.vue` → E2001

**Error**: Navigating to an external URL without `external: true`

`navigateTo('https://twitter.com/...')` is called without the `{ external: true }` option. Nuxt requires explicit opt-in for external navigation.

**Fix**: Add `{ external: true }`:
```ts
navigateTo('https://twitter.com/...', { external: true })
```

---

### `app/pages/cancel-checkout.vue` → E2003

**Error**: `abortNavigation()` called outside middleware

`abortNavigation()` is called from a click handler. It's only valid inside route middleware.

**Fix**: Use `navigateTo('/')` or `router.push('/')` for programmatic navigation. `abortNavigation` is exclusively for middleware.

---

### `app/pages/admin.vue` → E2004

**Error**: Unknown route middleware

The page declares `middleware: 'auth'` but no `auth` middleware file exists in `middleware/`.

**Fix**: Create `middleware/auth.ts`:
```ts
export default defineNuxtRouteMiddleware((to) => {
  // auth logic here
})
```

---

### `app/pages/counter.vue` → E7007

**Error**: `useState` init must be a function

`useState('counter', 0)` passes a raw value instead of an initializer function.

**Fix**: Wrap in a function:
```ts
const count = useState('counter', () => 0)
```

---

## Runtime: Warnings (runtimeWarn)

### `app/pages/user-profile.vue` → E3003, E3005, E3006

**E3003** — Component already mounted, use `$fetch` instead
- `useFetch()` is called inside `onMounted()`. By that point the component is already mounted, so `useFetch` can't participate in SSR.
- **Fix**: Move `useFetch` to the top level of `<script setup>`.

**E3005** — Do not pass `execute` directly to `watch`
- `watch(userId, fetchUser.execute)` passes `execute` as a direct callback. Vue's watcher calls it with `(newVal, oldVal)` which conflicts with `execute`'s expected signature.
- **Fix**: Wrap in an arrow function: `watch(userId, () => fetchUser.execute())`

**E3006** — `useAsyncData` handler returned `undefined`
- `async () => { await $fetch('/api/test') }` has no `return` statement, so it implicitly returns `undefined`. Server-side only warning.
- **Fix**: Add `return`: `async () => { return await $fetch('/api/test') }`

---

### `app/pages/blog-post.vue` → E4009, E4010, E6002

**E4009** — Nested `<a>` tags inside `<NuxtLink>`
- A `<NuxtLink>` is nested inside another `<NuxtLink>`, creating invalid nested `<a>` elements. Server-side warning.
- **Fix**: Restructure so NuxtLinks are not nested. Use a `<div>` wrapper with a separate link inside.

**E4010** — `<NuxtLink>` conflicting props
- `<NuxtLink to="/blog-post" href="/blog-post">` has both `to` and `href`, which are conflicting.
- **Fix**: Use only one: `<NuxtLink to="/blog-post">`.

**E6002** — `<Title>` slot must be a single string
- `<Title>Blog - <span>{{ post.title }}</span></Title>` has mixed content (text + element) in the slot.
- **Fix**: Use a computed string: `<Title>{{ 'Blog - ' + post.title }}</Title>`

---

### `app/pages/preferences.vue` → E7005

**E7005** — Cookie already expired
- `useCookie('session', { maxAge: -1 })` sets a negative `maxAge`, meaning the cookie is already expired and will never be set.
- **Fix**: Use `maxAge: 0` to delete or a positive value to keep the cookie. To clear a cookie, set its value to `null`.
