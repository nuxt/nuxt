<template>
  <div class="container">
    <h1>About page</h1>
    <ul>
      <li>
        <nuxt-link to="/about/profile">Profile</nuxt-link>
      </li>
      <li>
        <nuxt-link to="/about/contact">Contact</nuxt-link>
      </li>
    </ul>
    <nuxt-child/>
    <nuxt-link to="/">Home page</nuxt-link>
  </div>
</template>

<script>
export default {
  transition: 'fade'
}
</script>
