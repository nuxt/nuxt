<script setup lang="ts">
</script>

<template>
  <div>
    <h1 data-testid="home-title">Home</h1>
    <div class="test-actions">
      <NuxtLink to="/page-a" data-testid="nav-page-a">
        Page A (slow async)
      </NuxtLink>
      <NuxtLink to="/page-b" data-testid="nav-page-b">
        Page B (slow async)
      </NuxtLink>
      <NuxtLink to="/page-c" data-testid="nav-page-c">
        Page C (fast)
      </NuxtLink>
    </div>
  </div>
</template>
