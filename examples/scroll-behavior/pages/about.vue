<template>
  <div class="container">
    <h1>About page</h1>
    <ul>
      <li>
        <NuxtLink to="/about/profile">
          Profile
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/about/contact">
          Contact
        </NuxtLink>
      </li>
    </ul>
    <NuxtChild />
    <NuxtLink to="/">
      Home page
    </NuxtLink>
  </div>
</template>

<script>
export default {
  transition: 'fade'
}
</script>
