<script setup>
const { enabled, state } = usePreviewMode()

const { data } = await useFetch('/api/preview', {
  query: {
    apiKey: state.token || undefined
  }
})
</script>

<template>
  <div>
    <p id="enabled">
      {{ enabled }}
    </p>

    <p id="token-check">
      {{ state.token }}
    </p>

    <p id="correct-api-key-check">
      {{ data && data.hehe }}
    </p>
  </div>
</template>
