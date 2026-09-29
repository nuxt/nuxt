<script setup lang="ts">
const show = ref(true)
const plainCountOnFirstFrame = ref<number>()
const hydratedCountOnFirstFrame = ref<number>()

async function remount () {
  show.value = false
  await nextTick()
  show.value = true
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      plainCountOnFirstFrame.value = document.querySelectorAll('[data-testid="plain-remounted-component"]').length
      hydratedCountOnFirstFrame.value = document.querySelectorAll('[data-testid="hydrated-remounted-component"]').length
      resolve()
    })
  })
}
</script>

<template>
  <button
    data-testid="remount"
    @click="remount"
  >
    Remount
  </button>
  <output data-testid="plain-count-on-first-frame">
    {{ plainCountOnFirstFrame }}
  </output>
  <output data-testid="hydrated-count-on-first-frame">
    {{ hydratedCountOnFirstFrame }}
  </output>
  <template v-if="show">
    <LazyDelayedComponent
      v-for="n in 12"
      :key="`plain-${n}`"
      data-testid="plain-remounted-component"
    />
    <LazyDelayedComponent
      v-for="n in 12"
      :key="`hydrated-${n}`"
      data-testid="hydrated-remounted-component"
      hydrate-on-visible
    />
  </template>
</template>
