<template>
  <div class="container">
    <NuxtLink v-if="page > 1" :to="'?page=' + (page - 1)">
      &lt; Prev
    </NuxtLink>
    <a v-else class="disabled">
      &lt; Prev
    </a>
    <span>{{ page }}/{{ totalPages }}</span>
    <NuxtLink v-if="page < totalPages" :to="'?page=' + (page + 1)">
      Next &gt;
    </NuxtLink>
    <a v-else class="disabled">
      Next &gt;
    </a>
    <ul>
      <li v-for="user in users" :key="user.id">
        <img :src="user.avatar" class="avatar">
        <span>{{ user.first_name }} {{ user.last_name }}</span>
      </li>
    </ul>
    <p>
      <NuxtLink to="/">
        Back home
      </NuxtLink>
    </p>
  </div>
</template>

<script>
export default {
  // Watch for $route.query.page to call Component methods (asyncData, fetch, validate, layout, etc.)
  watchQuery: ['page'],
  // Key for <NuxtChild> (transitions)
  key: to => to.fullPath,
  // Called to know which transition to apply
  transition (to, from) {
    if (!from) { return 'slide-left' }
    return +to.query.page < +from.query.page ? 'slide-right' : 'slide-left'
  },
  async asyncData ({ query }) {
    const page = +(query.page || 1)
    const data = await fetch(`https://reqres.in/api/users?page=${page}`).then(res => res.json())
    return {
      page,
      totalPages: data.total_pages,
      users: data.data
    }
  },
  head: {
    title: 'Users'
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
  width: 100%;
  max-width: 400px;
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
