<template>
  <div>
    <p data-testid="shell-text">
      chunk error shell content
    </p>
    <Suspense>
      <AsyncBlock
        name="hook"
        :delay="120"
        :progress="100"
      />
      <template #fallback>
        <div data-testid="fallback">
          loading...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Chunk Error' })
</script>
