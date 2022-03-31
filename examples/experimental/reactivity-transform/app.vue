<script setup lang="ts">
let count = $ref(0)

function inc () {
  count++
}
function dec () {
  count--
}
</script>

<template>
  <NuxtExampleLayout example="experimental/reactivity-transform">
    <div>
      <Label :count="count" />
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
