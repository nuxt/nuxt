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
</script>

<template>
  <div>
    <h1>Mask Test Modal</h1>
    <p data-testid="modal-current-url">
      URL: {{ currentUrl }}
    </p>
    <p data-testid="modal-temp-location">
      TempLocation: {{ historyState?.__tempLocation || 'none' }}
    </p>
    <p data-testid="modal-mask-url">
      MaskUrl: {{ historyState?.__maskUrl || 'none' }}
    </p>
    <NuxtLink
      to="/mask-test"
      data-testid="back-link"
    >Back to Index</NuxtLink>
  </div>
</template>
