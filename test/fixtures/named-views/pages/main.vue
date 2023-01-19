<template lang="html">
  <div class="main">
    LEFT:<NuxtChild name="left" />:LEFT
    CHILD:<NuxtChild />:CHILD
  </div>
</template>

<script>
export default {
  // eslint-disable-next-line vue/no-reserved-component-names
  name: 'Main'
}
</script>

<style scoped>

</style>
