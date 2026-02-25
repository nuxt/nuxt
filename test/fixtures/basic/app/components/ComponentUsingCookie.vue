<script setup>
import { useCookieManager } from '../composables/cookie-manager'

const { showCookieBanner } = useCookieManager()
</script>

<template>
  <div
    v-if="showCookieBanner"
    id="child-banner"
  >
    child banner
  </div>
</template>
