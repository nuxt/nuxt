<script setup>
const route = useRoute()

const { enabled } = usePreviewMode({
  shouldEnable: () => {
    return !!route.query.customPreview
  },
})
</script>

<template>
  <div>
    <p id="enabled">
      {{ enabled }}
    </p>
  </div>
</template>
