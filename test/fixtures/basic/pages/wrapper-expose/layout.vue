<template>
  <div>
    <button class="swap-layout" @click="swapLayout">
      swap layout
    </button>
    <button class="log-foo" @click="logFoo">
      log foo
    </button>
    <button class="log-hello" @click="logHello">
      log hello
    </button>
    <NuxtLayout ref="layout" />
  </div>
</template>

<script setup lang="ts">
const layout = ref()
const currentLayout = useState('current-layout', () => 'custom')

definePageMeta({
  layout: 'custom'
})

function logFoo () {
  layout.value.layoutRef.logFoo()
}
function logHello () {
  layout.value.layoutRef.logHello()
}

function swapLayout () {
  currentLayout.value = currentLayout.value === 'custom2' ? 'custom' : 'custom2'
  setPageLayout(currentLayout.value)
}
</script>
