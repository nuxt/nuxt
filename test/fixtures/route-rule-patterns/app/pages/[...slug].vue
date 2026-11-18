<script setup lang="ts">
const route = useRoute()
const middlewareRuns = useState('probe-middleware', () => 0)
const rules = computed(() => getRouteRules({ path: route.path }))
</script>

<template>
  <main>
    <p id="page">
      slug-page
    </p>
    <pre id="rules">{{ JSON.stringify(rules) }}</pre>
    <p id="middleware">
      {{ middlewareRuns }}
    </p>
  </main>
</template>
