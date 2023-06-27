<script setup>
definePageMeta({
  // Nested <Suspense> + <Transition> is still buggy
  pageTransition: false,
  layoutTransition: false
})
const links = new Set(['sync', 'async'].flatMap(parent => [1, 2].flatMap(p => ['sync', 'async'].flatMap(child => [null, 1, 2].map(c => !c ? `/suspense/${parent}-${p}/` : `/suspense/${parent}-${p}/${child}-${c}/`)))))
</script>

<template>
  <div>
    This exists to test synchronous transitions between nested Suspense components.
    <hr>
    <NuxtLink v-for="link in links" :key="link" :to="link" style="display: block;">
      {{ link }}
    </NuxtLink>
    <hr>
    <div>
      <NuxtPage />
    </div>
  </div>
</template>
