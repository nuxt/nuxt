<script setup lang="ts" vapor>
// authoring the slot content inside a vapor component makes the slot function a
// vapor slot (marked `__vapor`), which is the case that VNode-shape inspection
// cannot safely handle
const show = ref(true)
</script>

<template>
  <div>
    <ClientOnly>
      <span data-testid="vapor-client-only-content">from vapor slot</span>
      <template #fallback>
        <span data-testid="vapor-client-only-fallback">fallback content</span>
      </template>
    </ClientOnly>

    <ClientOnly v-if="show">
      <span data-testid="vapor-client-only-multi-a">a</span>
      <span data-testid="vapor-client-only-multi-b">b</span>
    </ClientOnly>

    <DevOnly>
      <span data-testid="vapor-dev-only-content">dev vapor slot</span>
      <template #fallback>
        <span data-testid="vapor-dev-only-fallback">prod fallback</span>
      </template>
    </DevOnly>
  </div>
</template>
