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
const meta = useRoute().meta
for (const key in meta) {
  if (Array.isArray(meta[key])) {
    serialisedMeta[key] = meta[key].map((fn: Function) => fn.toString())
    continue
  }
  if (typeof meta[key] === 'string') {
    serialisedMeta[key] = meta[key]
    continue
  }
  if (typeof meta[key] === 'object') {
    serialisedMeta[key] = JSON.stringify(meta[key])
    continue
  }
  if (typeof meta[key] === 'function') {
    serialisedMeta[key] = meta[key].toString()
    continue
  }
}
</script>

<template>
  <pre>{{ serialisedMeta }}</pre>
</template>
