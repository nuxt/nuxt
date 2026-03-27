<script setup lang="ts">
const theme = useCookie('theme', { default: () => 'dark' })

function toggle () {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

useHead({
  htmlAttrs: {
    'data-theme': theme,
  },
})
</script>

<template>
  <button
    class="theme-toggle"
    @click="toggle"
  >
    {{ theme === 'dark' ? '☀️' : '🌙' }}
  </button>
</template>

<style scoped>
.theme-toggle {
  position: fixed;
  top: 1rem;
  right: 1rem;
  background: var(--border);
  border: 1px solid var(--border-btn);
  border-radius: 50%;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  padding: 0;
  z-index: 100;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.theme-toggle:hover {
  background: var(--border-hover);
  border-color: var(--border-btn-hover);
}
</style>
