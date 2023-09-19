<template>
  <div>
    <p>
      hello
    </p>
    <NuxtLink id="to-foo" to="/wrapper-expose/page">
      to foo
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">

function hello () {
  // eslint-disable-next-line no-console
  process.client && console.log('world')
}

defineExpose({
  hello
})
</script>
