<template>
  <div class="user">
    <h3>{{ name }}</h3>
    <p>Email : {{ email }}</p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data ({ params }) {
    return axios.get(`http://jsonplaceholder.typicode.com/users/${params.id}`)
    .then((res) => res.data)
  }
}
</script>

<style>
</style>
