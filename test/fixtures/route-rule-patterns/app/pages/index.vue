<script setup lang="ts">
const paths = ['/spa/a/b', '/redirect/a/b', '/middleware/a/b', '/module/a/b', '/cache/a/b']
const rules = Object.fromEntries(paths.map(path => [path, getRouteRules({ path })]))
</script>

<template>
  <main>
    <pre id="rules">{{ JSON.stringify(rules) }}</pre>
    <NuxtLink
      v-for="path in paths"
      :id="path.split('/')[1]"
      :key="path"
      :to="path"
    >
      {{ path }}
    </NuxtLink>
  </main>
</template>
