<script setup lang="ts">
</script>

<template>
  <div class="layout">
    <LayoutHeader />
    <nav>
      <NuxtLink
        to="/"
        data-testid="link-home"
      >Home</NuxtLink>
      <NuxtLink
        to="/other"
        data-testid="link-other"
      >Other</NuxtLink>
    </nav>
    <main>
      <slot />
    </main>
  </div>
</template>
