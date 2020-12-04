<template>
  <div>
    <div>
      <NLink to="/тест">
        unicode
      </NLink>
      <br>
      <NLink :to="encodeURI('/тест')">
        unicode (encoded)
      </NLink>
      <br>
      <NLink to="/тест?spa">
        unicode (SPA)
      </NLink>
      <br>
      <NLink :to="encodeURI('/тест?spa')">
        unicode (SPA encoded)
      </NLink>
      <br>
      <NLink to="/dynamic/سلام چطوری?q=cofee,food,دسر">
        dynamic
      </NLink>
      <br>
      <NLink :to="encodeURI('/dynamic/سلام چطوری?q=cofee,food,دسر')">
        dynamic (encodeURI)
      </NLink>
      <br>
      <NLink to="/dynamic/%D8%B3%D9%84%D8%A7%D9%85%20%DA%86%D8%B7%D9%88%D8%B1%DB%8C?q=cofee%2Cfood%2C%D8%AF%D8%B3%D8%B1">
        dynamic (encodeURIComponent)
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
