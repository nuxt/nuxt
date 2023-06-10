<template>
  <div>
    <NuxtPage ref="page" />

    <button id="log-hello" @click="logHello">
      hello
    </button>
    <button id="log-foo" @click="logFoo">
      foo
    </button>
  </div>
</template>

<script setup lang="ts">
const page = ref()

function logFoo () {
  page.value.page.foo()
}

function logHello () {
  page.value.page.hello()
}
</script>
