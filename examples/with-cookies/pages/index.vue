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
      <input type="text" v-model="newCookie.key" placeholder="Key" class="key"/>:
      <input type="text" v-model="newCookie.value" placeholder="Value" class="value"/>
      <button type="submit">Add</button>
    </form>
  </div>
</template>

<script>
export default {
  data: () => ({
    newCookie: {
      key: '',
      value: ''
    }
  }),
  computed: {
    cookies() {
      return this.$cookies.cookies
    }
  },
  methods: {
    addCookie() {
      // Make sure the cookie is not empty
      if (!this.newCookie.key || !this.newCookie.value) return
      // Sanitize the key to avoid spaces
      const cookieKey = this.newCookie.key.replace(/\s/g, '-')
      // Add the cookie
      this.$cookies.set(cookieKey, this.newCookie.value)
      // Reset newCookie data
      this.newCookie.key = this.newCookie.value = ''
    },
    removeCookie(key) {
      this.$cookies.remove(key)
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
