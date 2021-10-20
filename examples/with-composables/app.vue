<template>
  <div>
    {{ a }}
    {{ b }}
    {{ c }}
    {{ d }}
    {{ foo }}
  </div>
</template>

<script setup>
const a = useA()
const b = useB()
const c = useC()
const d = useD()
const foo = useFoo()
</script>
