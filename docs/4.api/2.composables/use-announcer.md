---
title: 'useAnnouncer'
description: A composable for announcing messages to screen readers.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/announcer.ts
    size: xs
---

::important
This composable is available in Nuxt v3.17+.
::

## Description

A composable for announcing dynamic content changes to screen readers. Unlike [`useRouteAnnouncer`](/docs/api/composables/use-route-announcer) which automatically announces route changes, `useAnnouncer` gives you manual control over what and when to announce.

Use this for in-page updates like form validation, async operations, toast notifications, and live content changes.

## Parameters

- `politeness`: Sets the default urgency for screen reader announcements: `off` (disable the announcement), `polite` (waits for silence), or `assertive` (interrupts immediately). (default `polite`)

## Properties

### `message`

- **type**: `Ref<string>`
- **description**: The current message to announce

### `politeness`

- **type**: `Ref<'polite' | 'assertive' | 'off'>`
- **description**: Screen reader announcement urgency level

## Methods

### `set(message, politeness = "polite")`

Sets the message to announce with its urgency level. The message is cleared first and then set via `nextTick` to ensure re-announcement of the same message.

### `polite(message)`

Sets the message with `politeness = "polite"`. Use for non-urgent updates that can wait for the screen reader to finish its current task.

### `assertive(message)`

Sets the message with `politeness = "assertive"`. Use for urgent updates that should interrupt the screen reader immediately.

## Example

```vue [app/pages/contact.vue]
<script setup lang="ts">
const { polite, assertive } = useAnnouncer()

async function submitForm() {
  try {
    await $fetch('/api/contact', { method: 'POST', body: formData })
    polite('Message sent successfully')
  } catch (error) {
    assertive('Error: Failed to send message')
  }
}
</script>
```

## Use Cases

### Form Validation

```vue [app/components/LoginForm.vue]
<script setup lang="ts">
const { assertive } = useAnnouncer()

function validateForm() {
  const errors = []
  if (!email.value) errors.push('Email is required')
  if (!password.value) errors.push('Password is required')
  
  if (errors.length) {
    assertive(`Form has ${errors.length} errors: ${errors.join(', ')}`)
    return false
  }
  return true
}
</script>
```

### Loading States

```vue [app/pages/dashboard.vue]
<script setup lang="ts">
const { polite } = useAnnouncer()

const { data, status } = await useFetch('/api/data')

watch(status, (newStatus) => {
  if (newStatus === 'pending') {
    polite('Loading data...')
  } else if (newStatus === 'success') {
    polite('Data loaded successfully')
  }
})
</script>
```

### Search Results

```vue [app/components/Search.vue]
<script setup lang="ts">
const { polite } = useAnnouncer()

const results = ref([])

watch(results, (newResults) => {
  polite(`Found ${newResults.length} results`)
})
</script>
```

::callout
You need to add the [`<NuxtAnnouncer>`](/docs/api/components/nuxt-announcer) component to your app for the announcements to be rendered in the DOM.
::