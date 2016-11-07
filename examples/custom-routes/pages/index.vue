<template>
  <div class="container">
    <h2>Users</h2>
    <ul class="users">
      <li v-for="user in users">
        <router-link :to="{ name: 'user', params: { id: user.id } }">{{ user.name }}</router-link>
      </li>
    </ul>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data () {
    return axios.get('http://jsonplaceholder.typicode.com/users')
    .then((res) => {
      return { users: res.data }
    })
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
