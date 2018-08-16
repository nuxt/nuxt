<template>
  <h1>login view</h1>
  <div>
    <label for="email">
      <input type="email" id="email">
    </label>
    <label for="password">
      <input type="password" id="password">
    </label>
    <button @click="postLogin">login</button>
  </div>
</template>

<script>
import Cookie from 'js-cookie'

export default {
  middleware: 'notAuthenticated',
  methods: {
    postLogin () {
      setTimeout(() => { // we simulate the async request with timeout.
        const auth = {
          accessToken: 'someStringGotFromApiServiceWithAjax'
        }
        this.$store.commit('update', auth) // mutating to store for client rendering
        Cookie.set('auth', auth) // saving token in cookie for server rendering
        this.$router.push('/')
      }, 1000)
    }
  }
}
</script>