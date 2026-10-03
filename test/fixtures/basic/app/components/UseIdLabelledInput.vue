<script setup lang="ts">
import { onMounted, ref, useId } from 'vue'

const id = useId()
const clientId = ref('')

onMounted(() => {
  clientId.value = id
})
</script>

<template>
  <div>
    <label :for="id">Name</label>
    <input
      :id="id"
      name="name"
    >
    <span data-testid="client-use-id">{{ clientId }}</span>
  </div>
</template>
