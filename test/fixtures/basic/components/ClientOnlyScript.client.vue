<script lang="ts">
export default defineNuxtComponent({
  name: 'ClientOnlyScript',
  props: {
    foo: {
      type: String
    }
  }
})
</script>

<template>
  <div>
    <div>client only script component {{ foo }}</div>
    <slot name="test" />
  </div>
</template>
