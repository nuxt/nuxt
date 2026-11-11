<script setup lang="ts">
const clicks = ref(0)
</script>

<template>
  <div class="slot-echo">
    <button
      class="slot-echo-inc"
      @click="clicks++"
    >
      echo {{ clicks }}
    </button>
    <slot />
  </div>
</template>
