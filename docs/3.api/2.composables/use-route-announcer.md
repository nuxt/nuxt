---
title: 'useRouteAnnouncer'
description: This composable gives you access to the title of the app page.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/route-announcer.ts
    size: xs
---

## Description

A composable which returns the title of the page. Used by [`<NuxtRouteAnnouncer>`](/docs/api/components/nuxt-route-announcer) and controllable.
It subscribes route guard [`beforeResolve`](/docs/api/composables/use-router#navigation-guards) and hooks into [`page:loading:end`](/docs/api/advanced/hooks#app-hooks-runtime) to change its message.

## Parameters

- `politeness`: Sets the urgency for screen reader announcements: off, polite (waits for silence), or assertive (interrupts immediately).  (default `polite`).

## Properties

### `message`

- **type**: `Ref<string>`
- **description**: The message to announce

### `politeness`

- **type**: `Ref<string>`
- **description**: Screen reader announcement urgency level `off`, `polite`, or `assertive`

## Methods

### `set(message, politeness)`

Set the message to announce with its' urgency level

### `polite(message)`

Set the message with `politeness = "polite"`

### `assertive(message)`

Set the message with `politeness = "assertive"`

## Example

```ts
<script setup lang="ts">
  const { message, politeness, set, polite, assertive } = useRouteAnnouncer({
    politeness: 'polite'
  })
</script>
```
