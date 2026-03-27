<script setup lang="ts">
const theme = useCookie('theme', { default: () => 'dark' })
const session = useCookie('session', { maxAge: -1 })
const language = useCookie('language', { default: () => 'en' })

function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>Preferences</h1>

    <div>
      <h2>Theme</h2>
      <p>Current: {{ theme }}</p>
      <button @click="toggleTheme">Toggle Theme</button>
    </div>

    <div>
      <h2>Language</h2>
      <p>Current: {{ language }}</p>
    </div>

    <div>
      <h2>Session</h2>
      <p>{{ session ?? 'No active session' }}</p>
    </div>
  </div>
</template>
