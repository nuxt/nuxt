<template>
  <div class="container clearfix">
    <h1>Nested routes example</h1>
    <h2>Users list</h2>
    <ul class="users">
      <li v-for="user in users">
        <nuxt-link :to="{ name: 'users-id', params: { id: user.id } }">{{ user.name }}</nuxt-link>
      </li>
    </ul>
    <nuxt-child :key="$route.params.id"></nuxt-child>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  transition: 'bounce',
  data () {
    return axios.get('https://jsonplaceholder.typicode.com/users')
    .then((res) => {
      return { users: res.data }
    })
  }
}
</script>

<style scoped>
.users {
  margin: 10px 0;
  float: left;
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
  color: #41b883;
}
</style>
