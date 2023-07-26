<script setup>
useCookie('accessed-but-not-used')
useCookie('accessed-with-default-value', () => 'default')
useCookie('set').value = 'set'
useCookie('set-to-null').value = null
useCookie('set-to-null-with-default', () => 'default').value = null
// the next set are all sent by browser
useCookie('browser-accessed-but-not-used')
useCookie('browser-accessed-with-default-value', () => 'default')
useCookie('browser-set').value = 'set'
useCookie('browser-set-to-null').value = null
useCookie('browser-set-to-null-with-default', () => 'default').value = null
</script>

<template>
  <div>
    <div>cookies testing page</div>
  </div>
</template>
