<script setup lang="ts">
const n = ref(0)
const { data } = await useAsyncData('prerender-watch-cache', () => Promise.resolve(`n=${n.value}`), { watch: [n] })
</script>

<template>
  <div>
    <div id="value">
      {{ data }}
    </div>
    <button
      id="bump"
      @click="n++"
    >
      bump
    </button>
  </div>
</template>
