<script setup lang="ts">
const open = ref(false)
// Lets tests wait for hydration before clicking.
const ready = ref(false)
onMounted(() => { ready.value = true })
</script>

<template>
  <div
    class="toggle-slot"
    :data-ready="ready"
  >
    <button
      class="toggle-slot-button"
      @click="open = !open"
    >
      {{ open ? 'close' : 'open' }}
    </button>
    <slot v-if="open" />
  </div>
</template>
