<script setup lang="ts">
definePageMeta({ layout: 'route-hash' })

const route = useRoute()
</script>

<template>
  <div>
    <div style="height: 300vh" />
    <h2
      id="section"
      :class="route.hash === '#section' ? 'active' : 'inactive'"
    >
      {{ route.hash }}
    </h2>
    <div style="height: 300vh" />
  </div>
</template>
