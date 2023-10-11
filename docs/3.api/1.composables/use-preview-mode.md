---
title: "usePreviewMode"
description: "Use usePreviewMode to check and control preview mode in Nuxt"
---

# `usePreviewMode`

You can use the built-in `usePreviewMode` composable to access and control preview state in Nuxt. If the composable detects preview mode it will automatically force any updates necessary for [`useAsyncData`](/docs/api/composables/use-async-data) and [`useFetch`](/docs/api/composables/use-fetch) to rerender preview content.

```js
// Just check if preview mode is enabled
const isPreview = usePreviewMode()

// Also, you can expose preview state
const { enabled, state } = usePreviewMode({ controls: true })
```

## Options

### Custom `enable` check

You can specify different check for enabling preview mode. By default [`usePreviewMode`](/docs/api/composables/use-preview-mode) composable will only check if `preview` param in url is equal to `true`.

```js
const enabled = usePreviewMode({
  shouldEnable: () => {
    return !!route.query.customPreview
  }
});
```

::alert{icon=👉}
This check should be performed on top level `usePreviewMode` call as top level components run first.
::

### Modify default state

The [`usePreviewMode`](/docs/api/composables/use-preview-mode) will try to store value of `token` param from url in state. You can modify this state and it will be availabe for all [`usePreviewMode`](/docs/api/composables/use-preview-mode) calls.

```js
const data1 = ref('data1')

const { enabled, state } = usePreviewMode({
  controls: true,
  getState: (currentState) => {
    return { data1, data2: 'data2' }
  }
})
```

::alert{icon=👉}
The `getState` function will append returned values to current state, so be careful not to accidentally overwrite important state.
::

## Example

```vue [pages/some-page.vue]
<script setup>
const route = useRoute()

const { enabled, state } = usePreviewMode({
  controls: true,
  shouldEnable: () => {
    return route.query.customPreview === 'true'
  },
})

const { data } = await useFetch('/api/preview', {
  query: {
    apiKey: state.token || undefined
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
