<script setup lang="ts" vapor>
const route = useRoute()
const state = useState('vapor-page-state', () => 'state-initial')
</script>

<template>
  <div>
    <h1 data-testid="page-title">
      Vapor page
    </h1>
    <p data-testid="route-path">
      {{ route.path }}
    </p>
    <p data-testid="use-state">
      {{ state }}
    </p>
    <VaporCounter label="vapor in vapor page" />
  </div>
</template>
