<script setup lang="ts">
const state = useState('ids', () => new Set<string>())
const idComponent = defineComponent({
  setup () {
    const id = useId()
    state.value.add(id)
    return () => h('div', id)
  }
})
onBeforeMount(() => {
  if (state.value.size !== 2) {
    showError('Number of ids generated: ' + state.value.size)
  }
})
</script>

<template>
  <div>
    Number of ids generated: {{ state.size }}
    <id-component />
    <id-component />
  </div>
</template>
