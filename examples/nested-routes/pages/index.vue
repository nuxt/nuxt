<template>
  <div class="container">
    <div class="left">
      <h2><nuxt-link to="/">Players</nuxt-link></h2>
      <ul class="players">
        <li v-for="user in users">
          <nuxt-link :to="'/'+user.id">{{ user.name }}</nuxt-link>
        </li>
      </ul>
    </div>
    <div class="right">
      <nuxt-child/>
    </div>
  </div>
</template>

<script>
export default {
  data ({ env }) {
    return { users: env.users }
  }
}
</script>

<style scoped>
.container {
  width: 100%;
  margin: 0;
  padding: 0;
  font-family: sans-serif;
  box-sizing: border-box;
}
.left {
  width: 50%;
  position: absolute;
  top: 0;
  left: 0;
}
.right {
  width: 50%;
  position: absolute;
  top: 0;
  right: 0;
}
.players {
  list-style-type: none;
  margin: 0;
  padding: 0;
}
.players li a {
  display: block;
  border: 1px #ddd solid;
  padding: 10px;
  text-align: left;
  color: #222;
  text-decoration: none;
}
.players li a:hover {
  color: orange;
}
</style>
