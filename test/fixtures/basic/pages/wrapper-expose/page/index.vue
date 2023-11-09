<template>
  <div>
    <p>foo</p>
    <NuxtLink
      id="to-hello"
      to="/wrapper-expose/page/another"
    >
      to hello
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
function foo () {
  console.log('bar')
}

defineExpose({
  foo
})
</script>
