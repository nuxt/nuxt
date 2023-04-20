<template>
  <NuxtExampleLayout example="auto-imports/composables">
    <p>Named export <code>useA</code> : {{ a }}</p>
    <p>Named export <code>useB</code> : {{ b }}</p>
    <p>Named export <code>useC</code> : {{ c }}</p>
    <p>Named export <code>useD</code> : {{ d }}</p>
    <p>Default export <code>useFoo</code> : {{ foo }}</p>
    <p>Star export <code>useNestedBar</code> : {{ bar }}</p>
  </NuxtExampleLayout>
</template>

<script setup>
const a = useA()
const b = useB()
const c = useC()
const d = useD()
const foo = useFoo()
const bar = useNestedBar()
</script>
