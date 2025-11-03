---
title: useHeadSafe
description: The recommended way to provide head data with user input.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

## Usage

The `useHeadSafe` composable is a wrapper around the [`useHead`](/docs/3.x/api/composables/use-head) composable that restricts the input to only allow safe values. This is the recommended way to manage head data when working with user input, as it prevents XSS attacks by sanitizing potentially dangerous attributes.

```vue [app/app.vue]
<script setup lang="ts">
useHeadSafe({
  script: [
    { id: 'xss-script', innerHTML: 'alert("xss")' },
  ],
  meta: [
    { 'http-equiv': 'refresh', content: '0;javascript:alert(1)' },
  ],
})
// Will safely generate
// <script id="xss-script"></script>
// <meta content="0;javascript:alert(1)">
</script>
```

::warning
When using `useHeadSafe`, potentially dangerous attributes like `innerHTML` in scripts or `http-equiv` in meta tags are automatically stripped out to prevent XSS attacks. Use this composable whenever you're working with user-generated content.
::

## Type

```ts [Signature]
export function useHeadSafe (input: MaybeComputedRef<HeadSafe>): void
```

### Allowed Attributes

The following attributes are whitelisted for each head element type:

```ts
const WhitelistAttributes = {
  htmlAttrs: ['class', 'style', 'lang', 'dir'],
  bodyAttrs: ['class', 'style'],
  meta: ['name', 'property', 'charset', 'content', 'media'],
  noscript: ['textContent'],
  style: ['media', 'textContent', 'nonce', 'title', 'blocking'],
  script: ['type', 'textContent', 'nonce', 'blocking'],
  link: ['color', 'crossorigin', 'fetchpriority', 'href', 'hreflang', 'imagesrcset', 'imagesizes', 'integrity', 'media', 'referrerpolicy', 'rel', 'sizes', 'type'],
}
```

See [@unhead/vue](https://github.com/unjs/unhead/blob/main/packages/vue/src/types/safeSchema.ts) for more detailed types.

## Parameters

`input`: A `MaybeComputedRef<HeadSafe>` object containing head data. You can pass all the same values as [`useHead`](/docs/3.x/api/composables/use-head), but only safe attributes will be rendered.

## Return Values

This composable does not return any value.

## Example

```vue [app/pages/user-profile.vue]
<script setup lang="ts">
// User-generated content that might contain malicious code
const userBio = ref('<script>alert("xss")</script>')

useHeadSafe({
  title: `User Profile`,
  meta: [
    {
      name: 'description',
      content: userBio.value, // Safely sanitized
    },
  ],
})
</script>
```

::read-more{to="https://unhead.unjs.io/docs/typescript/head/api/composables/use-head-safe" target="_blank"}
Read more on the `Unhead` documentation.
::
