---
title: "defineNuxtComponent"
description: defineNuxtComponent() is a helper function for defining type safe components with Options API.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/component.ts
    size: xs
---

::callout
`defineNuxtComponent()` is a helper function for defining type safe Vue components using options API similar to [`defineComponent()`](https://vuejs.org/api/general.html#definecomponent). `defineNuxtComponent()` wrapper also adds support for `asyncData` and `head` component options.
::

::callout{color="blue" icon="i-ph-info-duotone"}
Using `<script setup lang="ts">` is the recommended way of declaring Vue components in Nuxt 3.
::

:read-more{to=/docs/getting-started/data-fetching}

## `asyncData()`

If you choose not to use `setup()` in your app, you can use the `asyncData()` method within your component definition:

```vue [pages/index.vue]
<script lang="ts">
export default defineNuxtComponent({
  async asyncData() {
    return {
      data: {
        greetings: 'hello world!'
      }
    }
  },
})
</script>
```

## `head()`

If you choose not to use `setup()` in your app, you can use the `head()` method within your component definition:

```vue [pages/index.vue]
<script lang="ts">
export default defineNuxtComponent({
  head(nuxtApp) {
    return {
      title: 'My site'
    }
  },
})
</script>
```
