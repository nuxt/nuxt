<script setup lang="ts">
import fontURL from '/fonts/public.woff2'
import '~/assets/public-font.css'
</script>

<template>
  <a
    id="public-import"
    class="public-font"
    :href="fontURL"
  >font</a>
</template>

<style>
.public-font {
  background-image: url(/fonts/public.woff2);
}
</style>
