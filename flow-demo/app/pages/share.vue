<script setup lang="ts">
const pageUrl = 'https://nuxt.com'

function shareOnTwitter() {
  navigateTo(`https://twitter.com/intent/tweet?text=Check%20this%20out!&url=${pageUrl}`)
}

function shareOnFacebook() {
  navigateTo(`https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`)
}
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>Share this page</h1>
    <p>Spread the word about Nuxt!</p>
    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
      <button @click="shareOnTwitter">Share on Twitter</button>
      <button @click="shareOnFacebook">Share on Facebook</button>
    </div>
  </div>
</template>
