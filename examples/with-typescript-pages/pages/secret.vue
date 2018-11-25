<template>
  <div>Secret Page!</div>
</template>

<script lang="ts">
import Vue from 'vue'

export default Vue.extend({
  middleware: 'secret'
})
</script>
