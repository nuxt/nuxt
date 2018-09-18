<template>
  <div>
    <div v-if="$store.state.auth">
      <p>You are authenticated. You can see the
        <nuxt-link to="/secret">secret page</nuxt-link>!
      </p>
      <button @click="logout">Logout</button>
    </div>
    <p v-else>Please
      <nuxt-link to="/login">login</nuxt-link>.
    </p>
  </div>
</template>

<script>
const Cookie = process.browser ? require('js-cookie') : undefined

export default {
  methods: {
    logout() {
      Cookie.remove('auth')
      this.$store.commit('setAuth', null)
    }
  }
}
</script>
