<template>
  <div>
    {{ data }}
    <button :disabled="pending" @click="refresh">
      Refrash Data
    </button>
  </div>
</template>

<script setup>
const { data, refresh, pending } = await useAsyncData('/api/hello', () => $fetch('/api/hello'))
</script>
