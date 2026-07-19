<script lang="tsx">
import { defineComponent } from 'vue'

// A render-function SFC (no `<template>` block) exercises the JSX HMR path.
// See https://github.com/nuxt/nuxt/issues/30709
export default defineComponent({
  setup () {
    return () => <div data-testid="jsx-content">jsx: original</div>
  },
})
</script>
