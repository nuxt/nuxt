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
  transition (to, from) {
    if (!from || !from.params.id || !to.params.id) return 'fade'
    return +to.params.id > +from.params.id ? 'slide-left' : 'slide-right'
  },
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
  transition: all .5s cubic-bezier(.55,0,.1,1);
}
.slide-left-enter,
.slide-right-leave-active {
  opacity: 0;
  transform: translate(30px, 0);
}
.slide-left-leave-active,
.slide-right-enter {
  opacity: 0;
  transform: translate(-30px, 0);
}
</style>
