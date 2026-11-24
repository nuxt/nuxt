<script setup lang="ts">
const route = useRoute()
onBeforeRouteLeave(() => true)
onBeforeRouteUpdate(() => true)
const record = route.matched[0]!
const guards = record.leaveGuards.size + record.updateGuards.size
</script>

<template>
  <p>shared-record-guards:{{ guards }}</p>
</template>
