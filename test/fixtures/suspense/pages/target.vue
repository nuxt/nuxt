<script setup lang="ts">
/**
 * Target page for suspense navigation test
 */
const route = useRoute()
const id = computed(() => route.query.id || 'default')

// Simulate async data loading
await new Promise(resolve => setTimeout(resolve, 100))
</script>

<template>
  <div class="test-component">
    <h2>Target Page</h2>

    <div class="test-description">
      <p>This page demonstrates async data loading with suspense.</p>
    </div>

    <h3>Component Output:</h3>
    <div class="component-display">
      <div
        data-testid="content"
        class="content-box"
      >
        Hello {{ id }}
      </div>

      <div class="test-actions">
        <NuxtLink
          to="/"
          class="test-button"
        >
          Back to Home
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.content-box {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background-color: #f0f9f6;
  border-left: 4px solid #00DC82;
  border-radius: 4px;
}
</style>
