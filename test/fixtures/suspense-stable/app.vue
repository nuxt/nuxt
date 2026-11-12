<script setup lang="ts">
// Read the query once so prop-mode stays enabled for the whole app session.
const stableContent = useRoute().query.stable === '1'
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
