<script setup lang="ts">
definePageMeta({ alias: ['/preview-only-prerendered'] })

const { enabled } = usePreviewMode()
</script>

<template>
  <div>
    <PreviewOnly>
      <p id="preview-only-content">
        Preview content
      </p>
      <template #fallback>
        <p id="preview-only-fallback">
          Published content
        </p>
      </template>
    </PreviewOnly>
    <button
      id="toggle-preview-only"
      @click="enabled = !enabled"
    >
      Toggle preview
    </button>
  </div>
</template>
