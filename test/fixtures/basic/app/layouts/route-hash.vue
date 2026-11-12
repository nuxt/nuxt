<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div>
    <div
      id="layout-hash"
      :class="route.hash ? 'with-hash' : 'without-hash'"
    >
      {{ route.hash }}
    </div>
    <slot />
  </div>
</template>
