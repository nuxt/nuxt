<template>
  <ul class="users">
    <h2>Users</h2>
    <li v-for="user in users">
      <router-link :to="{ name: 'user', params: { id: user.id } }">{{ user.name }}</router-link>
    </li>
  </ul>
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

<style>

</style>
