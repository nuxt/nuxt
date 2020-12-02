<template>
  <div>
    <div>
      <NLink to="/тест">
        /тест
      </NLink>
      <NLink :to="encodeURI('/тест')">
        /тест (encoded)
      </NLink>
      <br>
      <NLink to="/тест?spa">
        /тест (SPA)
      </NLink>
      <NLink :to="encodeURI('/тест?spa')">
        /тест (SPA encoded)
      </NLink>
      <br>
      <NLink to="/query?q=food%2Ccoffee">
        /query?q=food%2Ccoffee
      </NLink>
    </div>
    <Nuxt />
  </div>
</template>

<style scoped>
a {
  color: grey;
  text-decoration: none;
}

.nuxt-link-exact-active {
  color: red;
  font-weight: bold;
}
</style>
