<template>
  <div class="container">
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
.container {
  text-align: center;
  padding-top: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}
ul {
  margin: 0;
  padding: 0;
  list-style-type: none;
}
li {
  display: inline-block;
}
a {
  display: inline-block;
  font-weight: 500;
  padding-top: .75rem;
  padding-bottom: .75rem;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
  text-transform: uppercase;
  text-decoration: none;
  box-shadow: 0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px 0 rgba(0,0,0,.06);
  border-radius: .25rem;
  border: none;
  background-color: #edf2f7;
  color: #2f495e;
  margin-right: 1rem;
}
a:hover {
  background-color: #e2e8f0;
}
.nuxt-link-exact-active {
  background-color: #00c58e;
  color: #fff;
}
.nuxt-link-exact-active:hover {
  background-color: #00e0a1;
}
</style>
