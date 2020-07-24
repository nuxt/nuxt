<template>
  <div>
    <input v-model="text">
  </div>
</template>

<script>
export default {
  data () {
    return {
      text: ''
    }
  },

  watch: {
    text (newVal) {
      const { toast } = this.$nuxt.$rootComponents

      if (toast) {
        toast.text = newVal
      }
    }
  }
}
</script>
