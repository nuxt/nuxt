<template>
  <div class="container">
    <h1>login view</h1>
    <div>
      <label for="email">
        <input id="email" type="email">
      </label>
      <label for="password">
        <input id="password" type="password">
      </label>
      <button @click="postLogin">login</button>
    </div>
  </div>
</template>

<script>
import Cookie from 'js-cookie'

export default {
  middleware: 'notAuthenticated',
  methods: {
    postLogin() {
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
