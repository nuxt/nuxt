<script setup lang="ts">
definePageMeta({ middleware: 'track' })
const route = useRoute()
</script>

<template>
  <div>
    <h1>experimental-router-user-{{ route.params.id }}</h1>
    <p id="query">
      {{ route.query.tab }}
    </p>
    <p id="middleware">
      {{ route.meta.tracked }}
    </p>
  </div>
</template>
