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
      <NLink to="/dynamic/سلام?q=food,cofee">
        dynamic
      </NLink>
      <br>
      <NLink :to="encodeURI('/dynamic/سلام?q=food,cofee')">
        dynamic (encodeURI)
      </NLink>
      <br>
      <NLink to="/dynamic/%D8%B3%D9%84%D8%A7%D9%85?q=coffee%2Cfood">
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
