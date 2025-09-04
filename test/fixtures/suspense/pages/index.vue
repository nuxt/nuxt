<script setup lang="ts">
/**
 * Test case: Suspense Multiple Navigation
 *
 * This demonstrates Nuxt's suspense functionality when
 * rapidly navigating between pages.
 */
async function trigger () {
  document.querySelector<HTMLButtonElement>('[data-testid="btn-a"]')!.click()
  await new Promise(resolve => setTimeout(resolve, 10))
  document.querySelector<HTMLButtonElement>('[data-testid="btn-b"]')!.click()
}
</script>

<template>
  <div class="test-component">
    <h2 data-testid="index-title">
      Suspense Multiple Navigation Test
    </h2>

    <div class="test-description">
      <p>
        This test verifies that Nuxt's suspense functionality works correctly when rapidly navigating
        between pages. It demonstrates that multiple rapid navigations don't cause errors or unexpected behavior.
      </p>
    </div>

    <h3>Navigation Actions:</h3>
    <div class="component-display">
      <div class="test-actions">
        <NuxtLink
          to="/target?id=a"
          data-testid="btn-a"
          class="test-button"
        >
          Target A
        </NuxtLink>
        <NuxtLink
          to="/target?id=b"
          data-testid="btn-b"
          class="test-button"
        >
          Target B
        </NuxtLink>
      </div>
    </div>

    <button @click="trigger">
      Trigger (for manual testing)
    </button>

    <div class="test-description">
      <h4>Test Instructions</h4>
      <p>
        Click both buttons in rapid succession to verify that suspense handles
        multiple navigations correctly. The final content should reflect the last
        navigation (Target B).
      </p>
    </div>
  </div>
</template>
