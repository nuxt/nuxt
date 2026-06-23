<template>
  <div>
    <h1 data-testid="title">
      Error During Stream
    </h1>
    <p data-testid="shell-text">
      shell content before the error
    </p>
    <Suspense>
      <StreamError />
      <template #fallback>
        <div data-testid="fallback">
          loading...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Error During Stream' })
</script>
