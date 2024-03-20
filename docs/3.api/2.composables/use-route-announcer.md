---
title: 'useRouteAnnouncer'
description: This composable watches the page load and updates the announcer message with the page title.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/route-announcer.ts
    size: xs
---

## Description

A composable which watches the page load and updates the announcer message with the page title. Used by [`<NuxtRouteAnnouncer>`](/docs/api/components/nuxt-route-announcer) and controllable.
It hooks into [`page:loading:end`](/docs/api/advanced/hooks#app-hooks-runtime) to read the page's title after loading and set it as the announcer message.

## Parameters

- `politeness`: Sets the urgency for screen reader announcements: `off` (disable the announcement), `polite` (waits for silence), or `assertive` (interrupts immediately).  (default `polite`).

## Properties

### `message`

- **type**: `Ref<string>`
- **description**: The message to announce

### `politeness`

- **type**: `Ref<string>`
- **description**: Screen reader announcement urgency level `off`, `polite`, or `assertive`

## Methods

### `set(message, politeness)`

Set the message to announce with its' urgency level. `politeness` is optional and set to `polite` if omitted

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
