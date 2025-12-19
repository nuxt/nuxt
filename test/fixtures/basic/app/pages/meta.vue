<script setup lang="ts">
definePageMeta({
  name: 'some-custom-name',
  path: '/some-custom-path',
  validate: () => true,
  middleware: [() => true],
  otherValue: {
    foo: 'bar',
  },
})

const serialisedMeta: Record<string, string> = {}
const route = useRoute()
const meta = route.meta
for (const key of ['name', 'path', ...Object.keys(meta)]) {
  const value = meta[key] || route[key]
  if (Array.isArray(value)) {
    serialisedMeta[key] = value.map((fn: () => unknown) => fn.toString())
    continue
  }
  if (typeof value === 'string') {
    serialisedMeta[key] = value
    continue
  }
  if (typeof value === 'object') {
    serialisedMeta[key] = JSON.stringify(value)
    continue
  }
  if (typeof value === 'function') {
    serialisedMeta[key] = value.toString()
    continue
  }
}
</script>

<template>
  <pre>{{ serialisedMeta }}</pre>
</template>
