<script setup lang="ts">
const historyState = ref<any>(null)
const currentUrl = ref('')

function updateState () {
  if (import.meta.client) {
    historyState.value = window.history.state
    currentUrl.value = window.location.pathname + window.location.search + window.location.hash
  }
}

onMounted(() => {
  updateState()
})

async function navigateWithMask () {
  await navigateTo('/mask-test/modal', { mask: '/mask-test/clean' })
  updateState()
}
</script>

<template>
  <div>
    <h1>Mask Test Index</h1>
    <p data-testid="index-current-url">
      URL: {{ currentUrl }}
    </p>
    <p data-testid="index-temp-location">
      TempLocation: {{ historyState?.__tempLocation || 'none' }}
    </p>
    <p data-testid="index-mask-url">
      MaskUrl: {{ historyState?.__maskUrl || 'none' }}
    </p>
    <button
      data-testid="navigate-mask"
      @click="navigateWithMask"
    >
      Navigate with Mask
    </button>
    <NuxtLink
      to="/mask-test/modal"
      mask="/mask-test/link-clean"
      data-testid="nuxt-link-mask"
    >
      NuxtLink with Mask
    </NuxtLink>
  </div>
</template>
