<script setup>
const hasIssue = ref(true)

const fixIssue = (error) => {
  hasIssue.value = false
  error.value = null
}

</script>

<template>
  <NuxtErrorBoundary>
    <throw-error v-if="hasIssue" />
    <div v-else>
      Component is working ^_^
    </div>

    <template #error="{ error }">
      Component failed to Render -_-
      <button @click="fixIssue(error)">
        (fix the issue)
      </button>
    </template>
  </NuxtErrorBoundary>
</template>
