<script setup lang="ts">
const Child = defineComponent({
  setup () {
    const id = useId()
    return () => h('div', id)
  },
})

onServerPrefetch(() => {})
</script>

<template>
  <Child />
</template>
