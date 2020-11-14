<template>
  <div>
    <h3>Welcome {{ $store.state.auth.user.name }}!</h3>
    <br>
    You visited this page <strong>{{ $store.state.counter }}</strong> times.
  </div>
</template>

<script>
export default {
  async asyncData ({ store }) {
    await store.dispatch('auth/FETCH_USER')
  },
  fetch () {
    this.$store.commit('COUNT')
  }
}
</script>
