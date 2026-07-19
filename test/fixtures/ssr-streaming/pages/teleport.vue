<template>
  <div>
    <h1 data-testid="title">
      Teleport Page
    </h1>
    <Teleport to="body">
      <div data-testid="teleported">
        teleported to body
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Teleport Page' })
</script>
