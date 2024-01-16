---
title: "refreshCookie"
description: "Refresh useCookie() ref values"
navigation:
  badge: New
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/cookie.ts
    size: xs
---

::callout{icon="i-ph-info-duotone" color="blue"}
This utility is available since [Nuxt v3.9.2](/blog/v3-9-2).
::

## Purpose

The `refreshCookie` function is designed to refresh cookie value returned by `useCookie`.

This is useful for updating the `useCookie` ref when we know the new cookie value has been set in the browser.

## Usage

```vue [app.vue]
<script setup lang="ts">
const tokenCookie = useCookie('token')

const login = async (username, password) => {
  const token = await $fetch('/api/token', { ... }) // Sets `token` cookie on response
  refreshCookie('token')
}

const loggedIn = computed(() => !!tokenCookie.value)
</script>
```

::callout{to="/docs/guide/going-further/experimental-features#refreshcookie"}
You can enable experimental `listenCookieChanges` option to automatically refresh `useCookie` value when cookie changes in the browser.
::

## Type

```ts
refreshCookie(name: string): void
```
