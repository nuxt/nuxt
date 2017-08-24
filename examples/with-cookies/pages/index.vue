<template>
  <div>
    <h1>Cookies</h1>
    <table>
      <thead>
        <tr>
          <th>Key</th><th>Value</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(value, key) in cookies">
          <td>{{ key }}</td>
          <td>{{ value }}</td>
          <td><button @click="removeCookie(key)">Remove</button></td>
        </tr>
      </tbody>
    </table>
    <h2>Add a new cookie</h2>
    <form @submit.prevent="addCookie">
      <input type="text" v-model="cookie.key" placeholder="Key" class="key"/>:
      <input type="text" v-model="cookie.value" placeholder="Value" class="value"/>
      <button type="submit">Add</button>
    </form>
  </div>
</template>

<script>
import { cookies, refreshCookies } from '~/plugins/cookies'
import Cookies from 'js-cookie'

export default {
  data() {
    return {
      cookies,
      cookie: { key: '', value: '' }
    }
  },
  methods: {
    addCookie() {
      if (!this.cookie.key || !this.cookie.value) return
      Cookies.set(this.cookie.key.replace(/\s/g, '-'), this.cookie.value)
      this.cookies = refreshCookies()
      this.cookie.key = this.cookie.value = ''
    },
    removeCookie(key) {
      Cookies.remove(key)
      this.cookies = refreshCookies()
    }
  }
}
</script>

<style scoped>
table {
  text-align: left;
}
th, td {
  padding-right: 10px;
}
input.key {
  width: 50px;
}
input.value {
  width: 100px;
}
input, button {
  border: 1px #ddd solid;
  background: white;
  padding: 5px;
}
button[type="submit"] {
  margin-left: 5px;
}
</style>
