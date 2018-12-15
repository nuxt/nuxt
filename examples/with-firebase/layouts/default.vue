<template>
  <div class="container">
    <div class="header">
      <nav>
        <h1 @click="$router.push('/')">
          Nuxt.js + Firebase
        </h1>
      </nav>
    </div>
    <Nuxt />
  </div>
</template>

<style>

body {
  padding-top: 1.5rem;
}

nav {
  padding: 1.5rem 0;
}

h1 {
  cursor: pointer;
  display: inline-block;
}

</style>
