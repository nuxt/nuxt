<template>
  <p>LOADING...</p>
</template>

<script>
export default {
  data () {
    return {
      duration: <%= loading.duration %>,
      loadingColor: '<%= loading.loadingColor %>',
      errorColor: '<%= loading.errorColor %>',
    }
  },
  methods: {
    start () {},
    increase () {},
    decrease () {},
    set () {},
    finish () {},
    pause () {},
    hide () {},
    fail () {}
  }
}
</script>

<style scoped>
  p {
    color: grey;
  }
</style>
