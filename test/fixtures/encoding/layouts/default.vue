<template>
  <div>
    <div>
      <ul>
        <li v-for="link in links" :key="link">
          <NLink :to="link">
            {{ link }}
          </NLink>
          <NLink :to="link.includes('?') ? link.replace('?', '?spa&') : (link + '?spa')">
            (spa)
          </NLink>
          <a :href="encodeURI('/ö') + link">(direct)</a>
        </li>
      </ul>
    </div>
    <Nuxt />
  </div>
</template>

<script>
export default {
  computed: {
    links () {
      return [
        '/redirect',
        '/@about',
        '/тест',
        encodeURI('/тест'),
        '/dynamic/%c',
        '/dynamic/%',
        '/dynamic/سلام چطوری?q=cofee,food,دسر',
        encodeURI('/dynamic/سلام چطوری?q=cofee,food,دسر'),
        // Using encodeURIComponent on each segment
        '/dynamic/%D8%B3%D9%84%D8%A7%D9%85%20%DA%86%D8%B7%D9%88%D8%B1%DB%8C?q=cofee%2Cfood%2C%D8%AF%D8%B3%D8%B1'
      ]
    }
  }
}
</script>

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
