---
title: "defineNuxtComponent"
description: defineNuxtComponent() is a helper function for defining type safe components with Options API.
---

# `defineNuxtComponent`

`defineNuxtComponent()` is a helper function for defining type safe Vue components using options API similar to [defineComponent()](https://vuejs.org/api/general.html#definecomponent). `defineNuxtComponent()` wrapper also adds support for `asyncData` component option.

::alert{type=warning}
Options API support for `asyncData` may well change before the stable release of Nuxt 3.
::

::Alert
Using `<script setup lang="ts">` is the recommended way of declaring Vue components in Nuxt 3.
::

:ReadMore{link=/getting-started/data-fetching#options-api-support}

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
