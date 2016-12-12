<template>
  <div class="container">
    <h2>User</h2>
    <h3>{{ user.name }}</h3>
    <h4>@{{ user.username }}</h4>
    <p>Email : {{ user.email }}</p>
    <p><router-link to="/users">List of users</router-link></p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data ({ params, error }) {
    return axios.get(`https://jsonplaceholder.typicode.com/users/${params.id}`)
    .then((res) => { return { user: res.data } })
    .catch(() => {
      error({ message: 'User not found', statusCode: 404 })
    })
  }
}
</script>

<style scoped>
.container
{
  text-align: center;
  overflow: hidden;
  min-height: 440px;
}
/*.user {
  text-align: center;
  margin-top: 100px;
  font-family: sans-serif;
}*/
</style>
