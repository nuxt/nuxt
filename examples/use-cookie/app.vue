<script setup>
const user = useCookie('user')
const logins = useCookie('logins')

const login = () => {
  logins.value = (logins.value || 0) + 1
  user.value = { name: 'CookieLover.' + new Date().getMilliseconds() }
}

const logout = () => {
  user.value = null
}
</script>

<template>
  <div v-if="user">
    <h1>Welcome {{ user.name }}</h1>
    <button @click="logout">
      Logout
    </button>
    <hr>
    You have logged in {{ logins }} times!
  </div>
  <div v-else>
    Click here to login:
    <button @click="login">
      Login
    </button>
  </div>
</template>
