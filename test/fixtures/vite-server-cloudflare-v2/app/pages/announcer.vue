<script setup lang="ts">
const { politeness } = useRouteAnnouncer()
</script>

<template>
  <p id="announcer">
    {{ politeness }}
  </p>
</template>
