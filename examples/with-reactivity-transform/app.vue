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
  <NuxtExampleLayout show-tips example="with-reactivity-transform">
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

    <template #tips>
      <div class="flex-auto">
        <p>
          This example demonstrates the support of Reactivity transforms in Nuxt 3.
        </p>
        <p>
          Read the documentation about
          <a href="https://vuejs.org/guide/extras/reactivity-transform.html" target="_blank">
            Reactivity Transform.
          </a>
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
