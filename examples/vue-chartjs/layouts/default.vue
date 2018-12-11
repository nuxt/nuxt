<template>
  <div>
    <ul>
      <li>
        <NuxtLink to="/">
          Activity
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/contributors">
          Contributors
        </NuxtLink>
      </li>
    </ul>
    <Nuxt />
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}
ul {
  margin: 0;
  padding: 0;
  list-style-type: none;
}
ul li {
  display: inline-block;
  float: left;
  border: 1px #ddd solid;
}
ul li a {
  display: inline-block;
  width: 100%;
  height: 100%;
  padding: 10px;
  color: #222;
  text-decoration: none;
}
ul li a.nuxt-link-exact-active {
  text-decoration: underline;
}
</style>
