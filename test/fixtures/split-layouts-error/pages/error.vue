<template>
  <h1>Error page</h1>
</template>

<script>
/* eslint no-undef: 0 */
export default {
  async asyncData ({ error }) {
    error(new Error('test error'))
  }
}
</script>
