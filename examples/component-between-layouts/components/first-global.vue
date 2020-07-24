<template>
  <div>
    I'm first global component!

    <input
      v-model="text"
      placeholder="Type into me"
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

  mounted () {
    alert('First global component mounted')
  }
}
</script>

<style>

</style>
