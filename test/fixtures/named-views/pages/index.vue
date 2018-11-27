<template lang="html">
  <div class="main">
    LEFT:<router-view name="left" />:LEFT
    CHILD:<nuxt-child />:CHILD
  </div>
</template>

<script>
export default {
  name: 'Stage'
}
</script>

<style scoped>

</style>
