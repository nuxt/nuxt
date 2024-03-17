---
title: "usePreviewMode"
description: "Use usePreviewMode to check and control preview mode in Nuxt"
---

# `usePreviewMode`

You can use the built-in `usePreviewMode` composable to access and control preview state in Nuxt. If the composable detects preview mode it will automatically force any updates necessary for [`useAsyncData`](/docs/api/composables/use-async-data) and [`useFetch`](/docs/api/composables/use-fetch) to rerender preview content.

```js
const { enabled, state } = usePreviewMode()
```

## Options

### Custom `enable` check

You can specify a custom way to enable preview mode. By default the `usePreviewMode` composable will enable preview mode if there is a `preview` param in url that is equal to `true` (for example, `http://localhost:3000?preview=true`). You can wrap the `usePreviewMode` into custom composable, to keep options consistent across usages and prevent any errors.

```js
export function useMyPreviewMode () {
  return usePreviewMode({
    shouldEnable: () => {
      return !!route.query.customPreview
    }
  });
}
```

### Modify default state

`usePreviewMode` will try to store the value of a `token` param from url in state. You can modify this state and it will be available for all [`usePreviewMode`](/docs/api/composables/use-preview-mode) calls.

```js
const data1 = ref('data1')

const { enabled, state } = usePreviewMode({
  getState: (currentState) => {
    return { data1, data2: 'data2' }
  }
})
```

::note
The `getState` function will append returned values to current state, so be careful not to accidentally overwrite important state.
::

## Example

```vue [pages/some-page.vue]
<script setup>
const route = useRoute()

const { enabled, state } = usePreviewMode({
  shouldEnable: () => {
    return route.query.customPreview === 'true'
  },
})

const { data } = await useFetch('/api/preview', {
  query: {
    apiKey: state.token
  }
})
</script>

<template>
  <div>
    Some base content

    <p v-if="enabled">
      Only preview content: {{ state.token }}

      <br>

      <button @click="enabled = false">
        disable preview mode
      </button>
    </p>
  </div>
</template>
```
