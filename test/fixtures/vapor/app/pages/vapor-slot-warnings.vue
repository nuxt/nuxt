<script setup lang="ts" vapor>
</script>

<template>
  <div>
    <Title>Vapor title</Title>
    <ClientOnly
      v-slot="slotProps"
      class="forwarded-class"
    >
      <span data-testid="vapor-client-only-slot-props">{{ JSON.stringify(slotProps) }}</span>
    </ClientOnly>
  </div>
</template>
