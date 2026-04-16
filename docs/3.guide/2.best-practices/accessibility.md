---
navigation.title: 'Accessibility'
title: Nuxt Accessibility
description: Best practices for building accessible Nuxt applications, with a focus on routing.
---

Single-page applications handle navigation on the client side, which means the browser does not trigger a full page load when users move between routes. Without proper handling, assistive technologies like screen readers may not detect that the page content has changed. Nuxt provides built-in features to address this.

## Page Titles

Every route should have a descriptive `<title>` so that users know where they are. Use [`useHead`](/docs/4.x/api/composables/use-head) or [`useSeoMeta`](/docs/4.x/api/composables/use-seo-meta) in each page to set it:

```vue [app/pages/products/[id].vue]
<script setup lang="ts">
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)

useHead({
  title: () => product.value?.name ?? 'Product',
})
</script>
```

Page titles are also used by [`<NuxtRouteAnnouncer>`](/docs/4.x/api/components/nuxt-route-announcer) to announce route changes to screen readers.

## Route Announcements

When users navigate between pages, screen readers need to be informed that new content has loaded. Nuxt provides [`<NuxtRouteAnnouncer>`](/docs/4.x/api/components/nuxt-route-announcer) which automatically reads the page `<title>` after each navigation and announces it to assistive technologies via an `aria-live` region.

```vue [app/app.vue]
<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

::important
This component is available in Nuxt v3.12+.
::

For custom announcement messages, use the [`useRouteAnnouncer`](/docs/4.x/api/composables/use-route-announcer) composable:

```vue [app/app.vue]
<script setup lang="ts">
const { set } = useRouteAnnouncer()

const router = useRouter()
router.afterEach((to) => {
  if (to.path === '/checkout') {
    set('Checkout - Step 1 of 3')
  }
})
</script>
```

:read-more{title="NuxtRouteAnnouncer" to="/docs/4.x/api/components/nuxt-route-announcer"}

## In-Page Content Announcements

Dynamic content changes that happen without a route change (form validation, toast notifications, loading states) also need to be communicated to screen readers. Use [`<NuxtAnnouncer>`](/docs/4.x/api/components/nuxt-announcer) with the [`useAnnouncer`](/docs/4.x/api/composables/use-announcer) composable:

```vue [app/app.vue]
<template>
  <NuxtAnnouncer />
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

```vue [app/pages/contact.vue]
<script setup lang="ts">
const name = ref('')
const message = ref('')
const { polite, assertive } = useAnnouncer()

async function submitForm () {
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: { name: name.value, message: message.value },
    })
    polite('Message sent successfully')
  } catch (error) {
    assertive('Error: Failed to send message. Please try again.')
  }
}
</script>
```

::important
This component is available in Nuxt v3.17+.
::

:read-more{title="NuxtAnnouncer" to="/docs/4.x/api/components/nuxt-announcer"}

## Accessible Navigation Links

[`<NuxtLink>`](/docs/4.x/api/components/nuxt-link) renders a standard `<a>` tag and includes several accessibility features by default:

- Adds `rel="noopener noreferrer"` on external links for security
- Supports the `ariaCurrentValue` prop to indicate the currently active link to screen readers

Use `ariaCurrentValue` in navigation menus so assistive technologies can identify the active page:

```vue [app/components/AppNav.vue]
<template>
  <nav aria-label="Main">
    <ul>
      <li>
        <NuxtLink
          to="/"
          aria-current-value="page"
        >Home</NuxtLink>
      </li>
      <li>
        <NuxtLink
          to="/about"
          aria-current-value="page"
        >About</NuxtLink>
      </li>
      <li>
        <NuxtLink
          to="/contact"
          aria-current-value="page"
        >Contact</NuxtLink>
      </li>
    </ul>
  </nav>
</template>
```

When the link matches the current route, Vue Router automatically applies `aria-current="page"`.

:read-more{title="NuxtLink" to="/docs/4.x/api/components/nuxt-link"}

## Focus Management

After a client-side navigation, focus stays on the previously clicked element or resets to the top of the document. For users relying on keyboard navigation, explicitly managing focus after route changes improves the experience:

```vue [app/app.vue]
<script setup lang="ts">
const mainContent = useTemplateRef('mainContent')
const router = useRouter()

router.afterEach(() => {
  nextTick(() => {
    mainContent.value?.focus()
  })
})
</script>

<template>
  <NuxtRouteAnnouncer />
  <AppNav />
  <main
    ref="mainContent"
    tabindex="-1"
  >
    <NuxtPage />
  </main>
</template>
```

Setting `tabindex="-1"` allows the element to receive focus programmatically without being part of the normal tab order.

## Skip Navigation

A skip-to-content link lets keyboard and screen reader users bypass repeated navigation elements on every page:

```vue [app/app.vue]
<template>
  <a
    href="#main-content"
    class="skip-link"
  >
    Skip to main content
  </a>
  <NuxtRouteAnnouncer />
  <AppNav />
  <main
    id="main-content"
    tabindex="-1"
  >
    <NuxtPage />
  </main>
</template>

<style>
.skip-link {
  position: absolute;
  top: -100%;
  left: 0;
  z-index: 100;
  padding: 1rem;
  background: var(--color-background);
}
.skip-link:focus {
  top: 0;
}
</style>
```

The link is visually hidden until the user tabs to it, then jumps focus to the main content area.

## Accessible Page Transitions

When using page transitions, respect users who prefer reduced motion. Use the `prefers-reduced-motion` media query to disable or simplify animations:

```vue [app/app.vue]
<template>
  <NuxtPage :transition="{ name: 'page', mode: 'out-in' }" />
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 200ms;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
```

:read-more{title="Page transitions" to="/docs/4.x/getting-started/transitions"}

## Loading States

When data is being fetched during navigation, communicate the loading state to all users. Use `aria-busy` on the content area and announce loading states to screen readers:

```vue [app/pages/products/index.vue]
<script setup lang="ts">
const { data: products, status } = await useLazyAsyncData('products', () => {
  return $fetch('/api/products')
})
</script>

<template>
  <div :aria-busy="status === 'pending'">
    <p
      v-if="status === 'pending'"
      role="status"
    >
      Loading products...
    </p>
    <ul v-else>
      <li
        v-for="product in products"
        :key="product.id"
      >
        {{ product.name }}
      </li>
    </ul>
  </div>
</template>
```

The `role="status"` attribute creates an implicit `aria-live="polite"` region, so screen readers will announce the loading text without interrupting the user.

## Useful Resources

For general web accessibility guidance beyond Nuxt-specific patterns, refer to:

1. [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
2. [MDN Accessibility Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
3. [Vue Accessibility Guide](https://vuejs.org/guide/best-practices/accessibility)
4. [A11y Project Checklist](https://www.a11yproject.com/checklist/)
