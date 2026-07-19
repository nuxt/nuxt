<script setup lang="ts">
definePageMeta({
  layout: false,
})
</script>

<template>
  <div id="issue-25317-page">
    <Suspense>
      <Issue25317Wrapper />
      <template #fallback>
        <div id="issue-25317-outer-fallback">
          outer-loading
        </div>
      </template>
    </Suspense>
  </div>
</template>
