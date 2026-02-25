<script lang="ts" setup>
// server only
useServerOnlyComposable()
// client only
useClientOnlyComposable()
// can only run client side, should be tree shaken from server build
setTitleToPink()
</script>

<template>
  <div>
    <h1>Tree Shake Example</h1>
  </div>
</template>
