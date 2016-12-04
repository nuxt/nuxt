<template>
  <div class="container">
    <h1>Please login to see the secret content</h1>
    <form v-if="!authUser" @submit.prevent="login">
      <p class="error" v-if="formError">{{ formError }}</p>
      <p><i>To login, use <b>demo</b> as username and <b>demo</b> as password.</i></p>
      <p>Username: <input type="text" v-model="formUsername" name="username" /></p>
      <p>Password: <input type="password" v-model="formPassword" name="password" /></p>
      <button type="submit">Login</button>
    </form>
    <div v-else>
      Hello {{ authUser.username }}!
      <pre>I am the secret content, I am shown only when the use is connected.</pre>
    </div>
  </div>
</template>

<script>
// Polyfill for window.fetch()
require('whatwg-fetch')

export default {
  data ({ req }) {
    console.log(req && req.session)
    return {
      authUser: (req && req.session.authUser) || null,
      formError: null,
      formUsername: '',
      formPassword: ''
    }
  },
  methods: {
    login () {
      fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: this.formUsername,
          password: this.formPassword
        })
      })
      .then((res) => {
        if (res.status === 401) {
          this.formError = 'Bad credentials'
        } else {
          return res.json()
        }
      })
      .then((authUser) => {
        this.authUser = authUser
      })
    }
  }
}
</script>

<style>
.container {
  padding: 100px;
}
.error {
  color: red;
}
</style>
