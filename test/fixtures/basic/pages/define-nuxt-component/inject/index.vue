<script lang="ts">
export default defineNuxtComponent({
  name: 'DefineNuxtComponentTest',
  setup () {
    const value = inject('foo')
    return {
      value,
    }
  },
})
</script>

<template>
  <div data-testid="define-nuxt-component-inject-value">
    {{ value }}
  </div>
</template>
