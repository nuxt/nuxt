<template>
  <button
    data-testid="island-counter"
    @click="count++"
  >
    count: {{ count }}
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>
