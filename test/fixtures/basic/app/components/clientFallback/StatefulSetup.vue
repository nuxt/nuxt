<template>
  <div>
    stateful setup {{ state }}
    <NuxtClientFallback>
      <BreakInSetup class="clientfallback-stateful-setup" />
    </NuxtClientFallback>
  </div>
</template>

<script setup>
const state = ref(1)
</script>
