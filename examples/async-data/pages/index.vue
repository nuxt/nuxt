<template>
  <div>
    Page visits: {{ data.count }}
  </div>
</template>

<script setup>
const { data } = await asyncData('time', () => $fetch('/api/count'))
</script>
