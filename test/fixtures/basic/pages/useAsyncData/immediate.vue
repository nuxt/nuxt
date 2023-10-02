<template>
  <div>
    Single
    <div>
      data: {{ data }}
    </div>
  </div>
</template>

<script setup lang="ts">
const called = ref(0)
const { data, execute } = await useAsyncData(() => Promise.resolve(++called.value), { immediate: false })

if (called.value !== 0) {
  throw new Error('Handled should have not been called')
}

if (import.meta.server && data.value !== null) {
  throw new Error('Initial data should be null: ' + data.value)
}

await execute()
await execute()

if (import.meta.server && called.value as number !== 2) {
  throw new Error('Should have been called once after execute (server) but called ' + called.value + ' times')
}

if (import.meta.client && called.value as number !== 2) {
  throw new Error('Should have been called once after execute (client) but called ' + called.value + ' times')
}

if (data.value !== 2) {
  throw new Error('Data should be 1 after execute')
}
</script>
