<script setup lang="ts">
const Child = defineComponent({
  setup () {
    const id = useId()
    return () => h('div', id)
  },
})

const id = useId()
useAsyncData('test', () => Promise.resolve('A'))
</script>

<template>
  <div>
    <Child />
    {{ id }}
  </div>
</template>
