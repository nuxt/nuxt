<script setup lang="ts">
function throwInTheBrowser (): never {
  throw new Error('boom from a click')
}
</script>

<template>
  <div>
    rendered without error
    <button @click="throwInTheBrowser()">
      throw
    </button>
  </div>
</template>
