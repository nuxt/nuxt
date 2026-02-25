<script setup>
const data1 = ref('data1')

const { enabled, state } = usePreviewMode({
  getState: () => {
    return { data1, data2: 'data2' }
  },
})

onMounted(() => {
  data1.value = 'data1 updated'
})
</script>

<template>
  <div>
    <NuxtLink
      id="with-use-fetch"
      to="/preview/with-use-fetch"
    >
      fetch check
    </NuxtLink>

    <p id="data1">
      {{ state.data1 }}
    </p>

    <p id="data2">
      {{ state.data2 }}
    </p>

    <button
      id="toggle-preview"
      @click="enabled = !enabled"
    >
      toggle preview mode
    </button>
  </div>
</template>
