<template>
  <div>
    <h1>Hello SPA!</h1>
    <NuxtLink to="/client-init?onClientInit=1">
      go to client-init
    </NuxtLink>
  </div>
</template>

<script>
export default {
  mounted () {
    window.indexMounted = (+window.indexMounted) + 1
    console.log('mounted') // eslint-disable-line no-console
  }
}
</script>
