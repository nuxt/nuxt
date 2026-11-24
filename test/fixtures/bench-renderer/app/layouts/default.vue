<script setup lang="ts">
const sections = ['catalog', 'links', 'product/1', 'product/2', 'blog/about', 'blog/careers', 'blog/pricing', 'blog/support']
</script>

<template>
  <div class="layout">
    <header>
      <nav>
        <NuxtLink
          v-for="section in sections"
          :key="section"
          :to="`/${section}`"
        >
          {{ section }}
        </NuxtLink>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <NuxtLink
        to="https://nuxt.com"
        external
      >
        nuxt.com
      </NuxtLink>
    </footer>
  </div>
</template>
