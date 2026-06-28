<script setup lang="ts">
const route = useRoute()
// Enable stableContent via query param for testing both modes
const stableContent = computed(() => route.query.stable === '1')
</script>

<template>
  <div>
    <nav>
      <NuxtLink to="/" data-testid="nav-home">
        Home
      </NuxtLink>
    </nav>
    <NuxtPage :stable-content="stableContent" />
  </div>
</template>
