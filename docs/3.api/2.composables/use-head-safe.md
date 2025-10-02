---
title: useHeadSafe
description: The recommended way to provide head data with user input.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/unjs/unhead/blob/main/packages/vue/src/composables.ts
    size: xs
---

The `useHeadSafe` composable is a wrapper around the [`useHead`](/docs/4.x/api/composables/use-head) composable that restricts the input to only allow safe values.

## Usage

You can pass all the same values as [`useHead`](/docs/4.x/api/composables/use-head)

```ts
useHeadSafe({
  script: [
    { id: 'xss-script', innerHTML: 'alert("xss")' },
  ],
  meta: [
    { 'http-equiv': 'refresh', 'content': '0;javascript:alert(1)' },
  ],
})
// Will safely generate
// <script id="xss-script"></script>
// <meta content="0;javascript:alert(1)">
```

::read-more{to="https://unhead.unjs.io/docs/typescript/head/api/composables/use-head-safe" target="_blank"}
Read more on the `Unhead` documentation.
::

## Type

```ts [Signature]
export function useHeadSafe (input: MaybeComputedRef<HeadSafe>): void
```

The list of allowed values is:

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
