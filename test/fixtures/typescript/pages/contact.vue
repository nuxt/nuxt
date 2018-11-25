<template>
  <div>{{ message }}</div>
</template>

<script lang="ts">
import Vue from 'vue'

export default Vue.extend({
  name: 'Contact',
  data() {
    return {
      message: 'Contact Page'
    }
  }
})
</script>
