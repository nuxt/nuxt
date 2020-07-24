<template>
  <div>
    <h1>Welcome!</h1>
    <NuxtLink to="/about">
      About page
    </NuxtLink>

    <input
      v-model="text"
      placeholder="Type text"
    >
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
      const first = this.getRoot()

      first.text = newVal
    }
  },

  mounted () {
    this.$nextTick(() => {
      const first = this.getRoot()

      if (first) {
        this.text = first.text
      }
    })
  },

  methods: {
    getRoot () {
      return this.$nuxt.$rootComponents.first
    }
  }
}
</script>
