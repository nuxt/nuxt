<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <div>
    <div
      v-for="twin in ['first', 'second']"
      :id="`${twin}-twin`"
      :key="twin"
    >
      <ServerSlots>
        <button
          class="twin-inc"
          @click="count++"
        >
          {{ twin }} {{ count }}
        </button>
        <template #in-client>
          <span class="twin-in-client">in client {{ count }}</span>
        </template>
      </ServerSlots>
    </div>
  </div>
</template>
