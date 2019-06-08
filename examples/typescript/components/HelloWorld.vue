<template>
  <div>
    {{ message }}
  </div>
</template>

<script lang="ts">
import Vue from 'vue'

export default Vue.extend({
  data() {
    return {
      message: 'Hello world !'
    }
  }
})
</script>
