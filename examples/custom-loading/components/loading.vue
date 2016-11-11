<template lang="html">
  <div class="loading-page" v-if="loading">
    <p>Loading...</p>
  </div>
</template>

<script>
export default {
  data: () => ({
    loading: false
  }),
  methods: {
    start () {
      this.loading = true
    },
    finish () {
      this.loading = false
    }
  }
}
</script>

<style lang="css">
.loading-page {
  width: 100%;
  height: 100%;
  background: white;
  position: fixed;
  top: 0;
  left: 0;
  text-align: center;
}
p {
  margin-top: 200px;
  font-size: 30px;
}
</style>
