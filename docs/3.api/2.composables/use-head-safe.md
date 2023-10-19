---
title: useHeadSafe
description: The recommended way to provide head data with user input.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/unhead/src/composables/useHeadSafe.ts
    size: xs
---

The `useHeadSafe` composable is a wrapper around the [`useHead`](/docs/api/composables/use-head) composable that restricts the input to only allow safe values.

## Usage

You can pass all the same values as [`useHead`](/docs/api/composables/use-head)

```ts
useHeadSafe({
  script: [
    { id: 'xss-script', innerHTML: 'alert("xss")' }
  ],
  meta: [
    { 'http-equiv': 'refresh', content: '0;javascript:alert(1)' }
  ]
})
// Will safely generate
// <script id="xss-script"></script>
// <meta content="0;javascript:alert(1)">
```

::read-more{to="https://unhead.unjs.io/usage/composables/use-head-safe" target="_blank"}
Read more on `unhead` documentation.
::

## Type

```ts
useHeadSafe(input: MaybeComputedRef<HeadSafe>): void
```

The whitelist of safe values is:

```ts
export default {
  htmlAttrs: ['id', 'class', 'lang', 'dir'],
  bodyAttrs: ['id', 'class'],
  meta: ['id', 'name', 'property', 'charset', 'content'],
  noscript: ['id', 'textContent'],
  script: ['id', 'type', 'textContent'],
  link: ['id', 'color', 'crossorigin', 'fetchpriority', 'href', 'hreflang', 'imagesrcset', 'imagesizes', 'integrity', 'media', 'referrerpolicy', 'rel', 'sizes', 'type'],
}
```

See [@unhead/schema](https://github.com/unjs/unhead/blob/main/packages/schema/src/safeSchema.ts) for more detailed types.
