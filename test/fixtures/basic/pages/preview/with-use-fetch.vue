<script setup>
const { token } = usePreviewMode({ controls: true })

const { data } = await useFetch('/api/preview', {
  query: {
    apiKey: token.value || undefined
  }
})
</script>

<template>
  <div>
    <p id="token-check">
      {{ token }}
    </p>

    <p id="correct-api-key-check">
      {{ data && data.hehe }}
    </p>
  </div>
</template>
