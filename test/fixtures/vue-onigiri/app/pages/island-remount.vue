<script setup lang="ts">
const visible = ref(true)
</script>

<template>
  <div>
    <div
      v-if="visible"
      id="remount-island"
    >
      <NuxtIsland
        name="RouteComponent"
        :context="{ url: '/remount' }"
      />
    </div>
    <button
      id="toggle-remount-island"
      @click="visible = !visible"
    >
      Toggle
    </button>
  </div>
</template>
