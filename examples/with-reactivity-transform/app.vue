<script setup lang="ts">
import Label from './label.vue'

let count = $ref(0)

function inc () {
  count++
}
function dec () {
  count--
}
</script>

<template>
  <NuxtExampleLayout :show-tips="true" example="with-reactivity-transform">
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
        Read the documentation about
        <NLink href="https://vuejs.org/guide/extras/reactivity-transform.html" target="_blank">
          Reactivity Transform.
        </NLink>
      </div>
    </template>
  </NuxtExampleLayout>
</template>
