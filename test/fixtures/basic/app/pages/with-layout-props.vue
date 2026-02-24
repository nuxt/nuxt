<script lang="ts" setup>
definePageMeta({
  layout: {
    name: 'custom',
    props: {
      foo: 'set props from page meta',
    },
  },
})
</script>

<template>
  <div>
    <div>with-layout-props.vue</div>
  </div>
</template>
