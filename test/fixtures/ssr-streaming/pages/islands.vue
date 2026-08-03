<template>
  <div>
    <h1 data-testid="title">
      Streaming Islands Home
    </h1>

    <IslandBlock message="hello from server" />

    <IslandWithSlot>
      <span data-testid="slot-content">slotted from page</span>
    </IslandWithSlot>

    <IslandWithClient />
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Streaming Islands' })
</script>
