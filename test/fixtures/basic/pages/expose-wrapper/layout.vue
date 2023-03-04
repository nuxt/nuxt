<template>
  <div>
    <button id="swap-layout" @click="swapLayout">
      swap layout
    </button>
    <button id="log-foo" @click="logFoo">
      log foo
    </button>
    <button id="log-hello" @click="logHello">
      log hello
    </button>
    <NuxtLayout ref="layout" />
  </div>
</template>

<script setup lang="ts">
const layout = ref()
let currentLayout = 'customLayout'

definePageMeta({
  layout: 'custom'
})

function logFoo () {
  layout.value.logFoo()
}
function logHello () {
  layout.value.logHello()
}

function swapLayout () {
  const newLayout = currentLayout === 'customLayout' ? 'customLayout2' : 'customLayout'
  setPageLayout(newLayout)
  currentLayout = newLayout
}
</script>
