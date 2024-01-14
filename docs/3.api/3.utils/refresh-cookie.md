---
title: "refreshCookie"
description: "Refresh cookie value returned by `useCookie`"
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

This is useful to update the `useCookie` ref when we know the new cookie value has been set.

## Usage

```vue [app.vue]
<script setup>
const tokenCookie = useCookie('token')

const login = async (username: string, password: string) => {
  // Sets `token` cookie on response
  const token = await $fetch('/api/token', { ... })

  // Refresh `tokenCookie` value
  refreshCookie('token')
})

// Cookie dependent computeds
const loggedIn = computed(() => !!tokenCookie.value)
</script>
```

## Type

```ts
refreshCookie(name: string): void
```
