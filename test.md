### What

6 locations where `new URL()` could throw unhandled `TypeError` on malformed user input, wrapped with `try/catch`.

---

### 1. `navigateTo()` — open handler (`router.ts:159`)

**Problem**

`toPath` comes directly from user input. A malformed value like `"http://a b.com"` throws raw `TypeError: Invalid URL` with no recovery and no clear message.

**Before**

```ts
const { protocol } = new URL(toPath, window.location.href)
```

After

```ts
let url: URL
try {
  url = new URL(toPath, window.location.href)
} catch {
  throw new Error(`Cannot navigate to invalid URL: '${toPath}'`)
}
const { protocol } = url
```

Solution

Catch the `TypeError` and re-throw as a descriptive `Error` that includes the bad input so the user knows exactly what went wrong.

---

### 2. `navigateTo()` — external URL validation (`router.ts:183`)

**Problem**

Same crash as #1, but on the external-URL code path. No clear message when `toPath` is invalid.

**Before**

```ts
const { protocol } = new URL(toPath, import.meta.client ? window.location.href : 'http://localhost')
```

After

```ts
let url: URL
try {
  url = new URL(toPath, import.meta.client ? window.location.href : 'http://localhost')
} catch {
  throw new Error(`Cannot navigate to invalid URL: '${toPath}'`)
}
const { protocol } = url
```

Solution

Identical pattern to #1. Same `let` + `try/catch` + descriptive `Error`.

---

### 3. `encodeURL()` — internal redirect encoder (`router.ts:344`)

**Problem**

`location` can come from a redirect target string. If it's malformed, the entire redirect logic crashes.

**Before**

```ts
const url = new URL(location, 'http://localhost')
```

After

```ts
let url: URL
try {
  url = new URL(location, 'http://localhost')
} catch {
  return location
}
```

Solution

Return the raw input as-is instead of crashing. The redirect still works, just un-encoded.

---

### 4. `<NuxtLink>` — prefetch path normalization (`nuxt-link.ts:422`)

**Problem**

`path` comes from the link's `to` value. An invalid path crashes prefetch silently in the background, potentially breaking the link render.

**Before**

```ts
const normalizedPath = isExternal.value
  ? new URL(path, window.location.href).href
  : path
```

After

```ts
const normalizedPath = (() => {
  try {
    return isExternal.value
      ? new URL(path, window.location.href).href
      : path
  } catch {
    return path
  }
})()
```

Solution

Wrap in an IIFE so `try/catch` works inside an expression. Fall back to the raw path — prefetch may be suboptimal but nothing crashes.

---

### 5. `<NuxtLink>` — slot route getter (`nuxt-link.ts:530`)

**Problem**

Called during template render. If `href.value` is malformed, the `new URL()` call crashes the entire component, producing a blank page.

**Before**

```ts
const url = new URL(href.value, import.meta.client ? window.location.href : 'http://localhost')
return {
  path: url.pathname,
  fullPath: url.pathname,
  // ...
}
```

After

```ts
let url: URL
try {
  url = new URL(href.value, import.meta.client ? window.location.href : 'http://localhost')
} catch {
  return undefined
}
return {
  path: url.pathname,
  fullPath: url.pathname,
  // ...
}
```

Solution

Return `undefined` on error. The slot prop route becomes `undefined` and the component handles "no route" gracefully instead of crashing.

---

### 6. `_getPayloadURL()` — payload URL parser (`payload.ts:79`)

**Problem**

Internal function. A crash here produces an unclear error that's hard to debug without tracing the call stack.

**Before**

```ts
const u = new URL(url, 'http://localhost')
```

After

```ts
let u: URL
try {
  u = new URL(url, 'http://localhost')
} catch {
  throw new Error('Invalid payload URL: ' + url)
}
```

Solution

Throw a clear error message that names "payload URL" and shows the value, making root cause immediately identifiable.

---

### Fallback Strategy

| Function | Strategy |
|---|---|
| `navigateTo` | Descriptive Error (user sees what went wrong) |
| `encodeURL` | Return input as-is (transparent, no-op) |
| `<NuxtLink>` prefetch | Return raw path (best-effort) |
| `<NuxtLink>` route getter | Return `undefined` (graceful degrade) |
| `_getPayloadURL` | Descriptive Error (debug-friendly) |

### Test

`packages/nuxt/test/url-try-catch.test.ts` — 15 assertions: `encodeURL` happy path and edge cases, `navigateTo` error behavior, `encodeRoutePath` sanity.

### Files

| File | Diff |
|---|---|
| `packages/nuxt/src/app/components/nuxt-link.ts` | +13/-2 |
| `packages/nuxt/src/app/composables/payload.ts` | +6/-1 |
| `packages/nuxt/src/app/composables/router.ts` | +20/-3 |
| `packages/nuxt/test/url-try-catch.test.ts` | new, +101 |
