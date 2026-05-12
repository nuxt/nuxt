<script setup lang="ts">
const showSearch = ref(false)

function toggleSearch () {
  showSearch.value = !showSearch.value
}

// Async setup - triggers #33680 scenario
await useLazyAsyncData('header-data', () => Promise.resolve({ loaded: true }))
</script>

<template>
  <header>
    <button
      data-testid="toggle-btn"
      @click="toggleSearch"
    >
      Toggle Search
    </button>
    <div data-testid="toggle-value">
      {{ showSearch ? 'ON' : 'OFF' }}
    </div>
    <div
      v-if="showSearch"
      data-testid="search-box"
    >
      Search is visible
    </div>
  </header>
</template>
