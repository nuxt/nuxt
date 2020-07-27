<template>
  <main>
    <nav>
      <NLink to="/">
        Home
      </NLink>
      <NLink to="/store">
        Store
      </NLink>
      <NLink to="/pagination/1">
        Pagination
      </NLink>
      <NLink to="/dynamic/foo bar/#hash">
        Dynamic route 1
      </NLink>
      <NLink to="/dynamic/foo%20bar">
        Dynamic route 2
      </NLink>
    </nav>
    <br>
    <Nuxt />
  </main>
</template>

<style scoped>
main {
  margin: 1em 1em;
}

nav {
  margin-bottom: 1em;
}

a {
  margin-right: 1em;
}
</style>
