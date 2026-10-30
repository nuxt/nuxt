---
title: 'defineUseAsyncDataMutationAddon'
description: Define a reusable addon that extends composables created with createUseAsyncDataMutation.
minimalVersion: "4.7"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/addons.ts
    size: xs
---

`defineUseAsyncDataMutationAddon` defines a reusable extension for `useAsyncDataMutation` composables created with [`createUseAsyncDataMutation`](/docs/api/composables/create-use-async-data-mutation).

An addon can declare custom call-site options, wrap the handler with middleware, attach custom reactive logic or extend the returned object.

:read-more{to="/docs/api/utils/define-use-fetch-mutation-addon" title="defineUseFetchMutationAddon: Addons for useAsyncDataMutation work the same way as useFetchMutation addons"}

## Usage

For example, an addon adding a `timed` option that logs how long each call takes:

```ts [app/composables/useLoggedMutation.ts]
const timing = defineUseAsyncDataMutationAddon({
  setup: (options: UseAsyncDataMutationAddonOptions<{ timed?: string }>) => {
    if (!options.timed) { return }
    options.middleware.push(async (next) => {
      const start = performance.now()
      try {
        return await next()
      } finally {
        console.info(`${options.timed} took ${Math.round(performance.now() - start)}ms`)
      }
    })
  },
})

export const useLoggedMutation = createUseAsyncDataMutation({ addons: [timing] })
```

```vue [app/components/NewsletterForm.vue]
<script setup lang="ts">
// logs "subscribe took 120ms" after each call
const { mutate } = useLoggedMutation(
  (address: string, { signal }) => $fetch('/api/newsletter', { method: 'POST', body: { address }, signal }),
  { timed: 'subscribe' },
)
</script>
```

::note
Addons run in the order of the `addons` array, with middleware from the first addon as the outermost wrapper. Listing the same addon object more than once runs it only once.
::

::note
A mutation is not awaitable, so `then`, `catch` and `finally` returned in the extension object are not merged into it.
::

## Type

```ts [Signature]
function defineUseAsyncDataMutationAddon<Opts extends Record<string, any> = {}, Ext = {}> (addon: {
  setup: (options: UseAsyncDataMutationAddonOptions<Opts>) => ((mutation: AsyncDataMutationAddonInstance) => Ext | void) | void
}): UseAsyncDataMutationAddon<Opts, Ext>
```
