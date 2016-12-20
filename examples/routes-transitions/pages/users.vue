<template>
  <div class="container" :key="page">
    <nuxt-link v-if="page > 1" :to="'?page=' + (page - 1)">&lt; Prev</nuxt-link>
    <a v-else class="disabled">&lt; Prev</a>
    <span>{{ page }}/{{ totalPages }}</span>
    <nuxt-link v-if="page < totalPages" :to="'?page=' + (page + 1)">Next &gt;</nuxt-link>
    <a v-else class="disabled">Next &gt;</a>
    <ul>
      <li v-for="user in users">
        <img :src="user.avatar" class="avatar" />
        <span>{{ user.first_name }} {{ user.last_name }}</span>
      </li>
    </ul>
    <p><nuxt-link to="/">Back home</nuxt-link></p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  transition (to, from) {
    if (!from) return 'slide-left'
    return +to.query.page < +from.query.page ? 'slide-right' : 'slide-left'
  },
  data ({ query }) {
    const page = +query.page || 1
    return axios.get('http://reqres.in/api/users?page=' + page)
    .then((res) => {
      return {
        page: +res.data.page,
        totalPages: res.data.total_pages,
        users: res.data.data
      }
    })
  }
}
</script>

<style scoped>
a {
  display: inline-block;
  margin: 0 1em;
  color: #34495e;
  text-decoration: none;
}
a.disabled {
  color: #ccc;
}
ul {
  margin: auto;
  padding: 0;
  width: 400px;
  padding-top: 40px;
}
li {
  list-style-type: none;
  width: 400px;
  border: 1px #ddd solid;
  overflow: hidden;
}
li img {
  float: left;
  width: 100px;
  height: 100px;
}
li span {
  display: inline-block;
  padding-top: 40px;
  text-transform: uppercase;
}
</style>
