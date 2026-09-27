<script setup lang="ts">
function throwInTheBrowser (): never {
  throw new Error('boom from a click')
}
</script>

<template>
  <div>
    click boom healthy
    <button @click="throwInTheBrowser()">
      throw
    </button>
    <NuxtLink to="/ok">
      to ok
    </NuxtLink>
  </div>
</template>
