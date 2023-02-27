---
description: The recommended way to provide head data with user input.
---

# `useHeadSafe`

The useHeadSafe composable is a wrapper around the [useHead](/docs/api/composables/use-head) composable that restricts the input to only allow safe values.

::ReadMore{link="https://unhead.harlanzw.com/guide/composables/use-head-safe"}
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
