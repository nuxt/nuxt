<template>
  <h1>Error page</h1>
</template>

<script>
/* eslint no-undef: 0 */
export default {
  data() {
    throw new Error('test youch !')
  }
}
</script>
