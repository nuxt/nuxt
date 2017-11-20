<template></template>

<script>
export default {
  middleware: 'redirect',
  created() {
    throw new Error('NOPE!')
  }
}
</script>
