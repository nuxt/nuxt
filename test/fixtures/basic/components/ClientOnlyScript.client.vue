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
    <div class="client-only-css">
      client only script component {{ foo }}
    </div>
    <slot name="test" />
  </div>
</template>

<style>
  :root {
    --client-only: 'client-only';
  }
</style>

<style scoped>
  .client-only-css {
    color: rgb(50, 50, 50);
  }
</style>
