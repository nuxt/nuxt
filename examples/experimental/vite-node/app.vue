<script setup lang="ts">
const count = ref(0)

function inc () {
  count.value++
}
function dec () {
  count.value--
}
</script>

<template>
  <NuxtExampleLayout example="experimental/vite-node">
    <div>
      {{ count }}
      <div class="flex gap-1 justify-center">
        <NButton @click="inc()">
          Inc
        </NButton>
        <NButton @click="dec()">
          Dec
        </NButton>
      </div>
    </div>
  </NuxtExampleLayout>
</template>
