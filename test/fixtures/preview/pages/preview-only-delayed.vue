<script setup lang="ts">
const route = useRoute()
const nuxtApp = useNuxtApp()
const enableCalls = ref(0)
const disableCalls = ref(0)
let preview: ReturnType<typeof usePreviewMode> | undefined

function initialize () {
  preview = nuxtApp.runWithContext(() => usePreviewMode({
    shouldEnable: () => route.query.customPreview === 'true',
    onEnable: () => { enableCalls.value++ },
    onDisable: () => { disableCalls.value++ },
  }))
}

function disable () {
  if (preview) {
    preview.enabled.value = false
  }
}
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
      id="initialize-preview-only"
      @click="initialize"
    >
      Initialize preview
    </button>
    <button
      id="disable-preview-only"
      @click="disable"
    >
      Disable preview
    </button>
    <span id="preview-only-enable-calls">{{ enableCalls }}</span>
    <span id="preview-only-disable-calls">{{ disableCalls }}</span>
  </div>
</template>
