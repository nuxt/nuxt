<template>
  <div class="container">
    <h2>Users</h2>
    <ul class="users">
      <li v-for="user in users">
        <nuxt-link :to="'/users/'+user.id">{{ user.name }}</nuxt-link>
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  async asyncData() {
    const { data } = await axios.get('https://jsonplaceholder.typicode.com/users')
    return { users: data }
  }
}
</script>

<style scoped>
.container {
  text-align: center;
  margin-top: 100px;
  font-family: sans-serif;
}
.users {
  list-style-type: none;
}
.users li a {
  display: inline-block;
  width: 200px;
  border: 1px #ddd solid;
  padding: 10px;
  text-align: left;
  color: #222;
  text-decoration: none;
}
.users li a:hover {
  color: orange;
}
</style>
