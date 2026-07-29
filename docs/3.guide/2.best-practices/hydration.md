---
navigation.title: 'Nuxt and Hydration'
title: Nuxt and Hydration
description: Why fixing hydration issues is important
---

When developing, you may face hydration issues. Don't ignore those warnings.

## Why Is It Important to Fix Them?

Hydration mismatches are not just warnings - they are indicators of serious problems that can break your application:

### Performance Impact

- **Increased time to interactive**: Hydration errors force Vue to re-render the entire component tree, which will increase the time for your Nuxt app to become interactive
- **Poor user experience**: Users may see content flashing or unexpected layout shifts

### Functionality Issues

- **Broken interactivity**: Event listeners may not attach properly, leaving buttons and forms non-functional
- **State inconsistencies**: Application state can become out of sync between what the user sees and what the application thinks is rendered
- **SEO problems**: Search engines may index different content than what users actually see

## How to Detect Them

### Development Console Warnings

Vue will log hydration mismatch warnings in the browser console during development:

![Screenshot of Vue hydration mismatch warning in the browser console](/assets/docs/best-practices/vue-console-hydration.png)

### Debugging Hydration Mismatches

Hydration mismatches are reported as **Vue console warnings** in the browser during development. Nuxt does not currently provide a built-in error overlay for hydration mismatches (unlike the dev `<nuxt-error-overlay>` used for SSR and server runtime errors).

To make mismatches easier to spot while developing, you can:

- Enable detailed mismatch output with [`debug`](/docs/4.x/api/nuxt-config#debug):

```ts twoslash [nuxt.config.ts]
export default defineNuxtConfig({
  debug: {
    hydration: true,
  },
})
```

Setting `debug: true` also enables hydration debugging along with other debug options.

- Install the community [`nuxt-hydration`](https://github.com/huang-julien/nuxt-hydration) module, which surfaces hydration issues more prominently in development.

Production builds may not log the same warnings, but hydration mismatches can still break interactivity, cause layout shifts, and hurt SEO. Treat console warnings in development as signals to fix before shipping.

::read-more{to="/docs/4.x/guide/going-further/debugging"}
Learn more about debugging Nuxt applications.
::

### Choosing a Client-Only Strategy

When server and client output cannot match, pick the approach that fits your use case:

| Approach | When to use |
| --- | --- |
| [`<ClientOnly>`](/docs/4.x/api/components/client-only) with `#fallback` | Wrap a subtree that must not render on the server; show placeholder HTML until the client mounts |
| [`.client.vue` components](/docs/4.x/directory-structure/app/components#client-components) | Entire component files that should never run during SSR |
| [`onMounted`](https://vuejs.org/api/composition-api-lifecycle#onmounted) or [`import.meta.client`](/docs/4.x/api/advanced/import-meta) | Browser-only side effects (analytics, third-party widgets) after the component is active |
| [`useFetch`](/docs/4.x/api/composables/use-fetch) / [`useAsyncData`](/docs/4.x/api/composables/use-async-data) with `server: false` | Data that should load only on the client |

Prefer SSR-friendly alternatives when you can: [`useState`](/docs/4.x/api/composables/use-state), [`useCookie`](/docs/4.x/api/composables/use-cookie), and [`NuxtTime`](/docs/4.x/api/components/nuxt-time) keep server and client markup aligned without skipping SSR.

::read-more{to="/docs/4.x/guide/concepts/server-and-client"}
See what runs on the server, during hydration, and after mount.
::

### Dev-Only Debugging Aids

Use [`<DevOnly>`](/docs/4.x/api/components/dev-only) for debug panels and tooling that should never ship to production. Its content is tree-shaken from production builds.

If you provide a `#fallback` slot, test the production output with [`nuxt preview`](/docs/4.x/api/commands/preview) so you know what users will see.

`<DevOnly>` is not a substitute for `<ClientOnly>`. Dev-only content is removed in production; client-only content still renders for end users once the app mounts in the browser.

## Common Reasons

### Browser-only APIs in Server Context

**Problem**: Using browser-specific APIs during server-side rendering.

```html
<template>
  <div>User preference: {{ userTheme }}</div>
</template>

<script setup>
// This will cause hydration mismatch!
// localStorage doesn't exist on the server!
const userTheme = localStorage.getItem('theme') || 'light'
</script>
```

**Solution**: You can use [`useCookie`](/docs/4.x/api/composables/use-cookie):

```html
<template>
  <div>User preference: {{ userTheme }}</div>
</template>

<script setup>
// This works on both server and client
const userTheme = useCookie('theme', { default: () => 'light' })
</script>
```

### Inconsistent Data

**Problem**: Different data between server and client.

```html
<template>
  <div>{{ Math.random() }}</div>
</template>
```

**Solution**: Use SSR-friendly state:

```html
<template>
  <div>{{ state }}</div>
</template>

<script setup>
const state = useState('random', () => Math.random())
</script>
```

### Conditional Rendering Based on Client State

**Problem**: Using client-only conditions during SSR.

```html
<template>
  <div v-if="window?.innerWidth > 768">
    Desktop content
  </div>
</template>
```

**Solution**: Use media queries or handle it client-side:

```html
<template>
  <div class="responsive-content">
    <div class="hidden md:block">Desktop content</div>
    <div class="md:hidden">Mobile content</div>
  </div>
</template>
```

### Third-party Libraries with Side Effects

**Problem**: Libraries that modify the DOM or have browser dependencies (this happens a LOT with tag managers).

```html
<script setup>
if (import.meta.client) {
    const { default: SomeBrowserLibrary } = await import('browser-only-lib')
    SomeBrowserLibrary.init()
}
</script>
```

**Solution**: Initialise libraries after hydration has completed:

```html
<script setup>
onMounted(async () => {
  const { default: SomeBrowserLibrary } = await import('browser-only-lib')
  SomeBrowserLibrary.init()
})
</script>
```

### Dynamic Content Based on Time

**Problem**: Content that changes based on current time.

```html
<template>
  <div>{{ greeting }}</div>
</template>

<script setup>
const hour = new Date().getHours()
const greeting = hour < 12 ? 'Good morning' : 'Good afternoon'
</script>
```

**Solution**: Use [`NuxtTime`](/docs/4.x/api/components/nuxt-time) component or handle it client-side:

```html
<template>
  <div>
    <NuxtTime :date="new Date()" format="HH:mm" />
  </div>
</template>
```

```html
<template>
  <div>
    <ClientOnly>
      {{ greeting }}
      <template #fallback>
        Hello!
      </template>
    </ClientOnly>
  </div>
</template>

<script setup>
const greeting = ref('Hello!')

onMounted(() => {
  const hour = new Date().getHours()
  greeting.value = hour < 12 ? 'Good morning' : 'Good afternoon'
})
</script>
```

## In Summary

1. **Watch the browser console in development** for hydration mismatch warnings and fix them before production
2. **Use SSR-friendly composables**: [`useFetch`](/docs/4.x/api/composables/use-fetch), [`useAsyncData`](/docs/4.x/api/composables/use-async-data), [`useState`](/docs/4.x/api/composables/use-state)
3. **Pick the right client-only tool** when SSR and client output cannot match: [`ClientOnly`](/docs/4.x/api/components/client-only), [`.client.vue`](/docs/4.x/directory-structure/app/components#client-components), or `onMounted`
4. **Keep data consistent** between server and client renders
5. **Avoid side effects in setup**: Move browser-dependent code to `onMounted`

::tip
Read the [Vue documentation on SSR hydration mismatch](https://vuejs.org/guide/scaling-up/ssr#hydration-mismatch) and the [Server and Client](/docs/4.x/guide/concepts/server-and-client) guide for more context on where your code runs.
::
