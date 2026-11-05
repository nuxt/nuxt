---
title: 'createUseAsyncDataMutation'
description: A factory function to create a custom useAsyncDataMutation composable with pre-defined default options.
minimalVersion: "4.7"
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncDataMutation.ts
    size: xs
---

`createUseAsyncDataMutation` creates a custom [`useAsyncDataMutation`](/docs/api/composables/use-async-data-mutation) composable with pre-defined options. The resulting composable is fully typed and works exactly like `useAsyncDataMutation`, but with your defaults baked in.

::note
Unlike [`createUseAsyncData`](/docs/api/composables/create-use-async-data), this is not a compiler macro. Mutations are not keyed, so the composable can be created anywhere, though the `composables/` directory makes it auto-imported.
::

## Usage

```ts [app/composables/useTimedMutation.ts]
export const useTimedMutation = createUseAsyncDataMutation({
  timeout: 10_000,
})
```

```vue [app/components/NewsletterForm.vue]
<script setup lang="ts">
const { status, mutate } = useTimedMutation(
  (address: string, { signal }) => $fetch('/api/newsletter', { method: 'POST', body: { address }, signal }),
)
</script>
```

The resulting composable has the same signature and return type as [`useAsyncDataMutation`](/docs/api/composables/use-async-data-mutation), with all options available for the caller to use or override. A `transform` or `default` set on the factory is reflected in the type of `data`.

## Type

```ts [Signature]
function createUseAsyncDataMutation (
  options?: Partial<AsyncDataMutationOptions> & { addons?: UseAsyncDataMutationAddon[] },
): typeof useAsyncDataMutation

function createUseAsyncDataMutation (
  options: (callerOptions: AsyncDataMutationOptions) => Partial<AsyncDataMutationOptions>,
): typeof useAsyncDataMutation
```

The returned composable's signature includes any custom options and return-value extensions contributed by the [addons](#addons).

## Options

`createUseAsyncDataMutation` accepts all the same options as [`useAsyncDataMutation`](/docs/api/composables/use-async-data-mutation#parameters): `default`, `transform`, `deep`, `timeout` and `middleware`.

## Default vs Override Mode

### Default Mode (plain object)

When you pass a plain object, the factory options act as **defaults**. Callers can override any option:

```ts [app/composables/useTimedMutation.ts]
export const useTimedMutation = createUseAsyncDataMutation({
  timeout: 10_000,
})
```

```ts
// Uses the default timeout
const { mutate } = useTimedMutation(
  (address: string, { signal }) => $fetch('/api/newsletter', { method: 'POST', body: { address }, signal }),
)

// Caller overrides the timeout
const { mutate } = useTimedMutation(
  (file: File, { signal }) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch('/api/upload', { method: 'POST', body, signal })
  },
  { timeout: 60_000 },
)
```

### Override Mode (function)

When you pass a function, the factory options **override** the caller's options. The function receives the caller's options as its argument:

```ts [app/composables/useShallowMutation.ts]
// deep is always enforced as false
export const useShallowMutation = createUseAsyncDataMutation(callerOptions => ({
  deep: false,
}))
```

In both modes, an option set to `undefined` is ignored rather than overriding the other side.

## Addons

In addition to `useAsyncDataMutation` options, `createUseAsyncDataMutation` accepts an `addons` array. Addons are reusable units of behavior defined with [`defineUseAsyncDataMutationAddon`](/docs/api/utils/define-use-async-data-mutation-addon). They can declare custom call-site options, run middleware around the handler, extend the returned object, and attach custom logic to the composable.

For example, an addon that adds a `succeededAt` ref recording when the latest call succeeded:

```ts [app/composables/useTrackedMutation.ts]
const succeededAt = defineUseAsyncDataMutationAddon({
  setup: () => (mutation) => {
    const at = ref<Date>()
    watch(mutation.status, (status) => {
      if (status === 'success') { at.value = new Date() }
    })
    return { succeededAt: readonly(at) } // 👈 extend the returned object with a new property
  },
})

export const useTrackedMutation = createUseAsyncDataMutation({ addons: [succeededAt] })
```

```vue [app/components/ProfileForm.vue]
<script setup lang="ts">
// `succeededAt` is typed on the created composable
const { mutate, succeededAt } = useTrackedMutation(
  (profile: { name: string }, { signal }) => $fetch('/api/profile', { method: 'PUT', body: profile, signal }),
)
</script>
```

:read-more{to="/docs/api/utils/define-use-async-data-mutation-addon"}

:read-more{to="/docs/api/composables/use-async-data-mutation"}
