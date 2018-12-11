<template>
  <div class="container">
    <h1>Home page</h1>
    <p>
      <NuxtLink to="/about">
        About page
      </NuxtLink>
    </p>
    <p>
      <NuxtLink to="/users">
        Lists of users
      </NuxtLink>
    </p>
    <p>
      <NuxtLink to="/users-2">
        Lists of users #2 (with `watch`)
      </NuxtLink>
    </p>
  </div>
</template>

<script>
export default {
  head: {
    title: 'Home'
  }
}
</script>
