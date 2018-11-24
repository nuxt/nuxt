<template>
  <div>
    <h3>Cars</h3>
    <ul>
      <li v-for="car in allCars" :key="car.id">
        <NuxtLink :to="`car/${car.id}`">
          {{ car.year }} {{ car.make }} {{ car.model }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script>
import allCars from '~/apollo/queries/allCars'

export default {
  apollo: {
    allCars: {
      prefetch: true,
      query: allCars
    }
  },
  head: {
    title: 'Cars with Apollo'
  }
}
</script>

<style>
ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}
a {
  text-decoration: none;
  color: #3498DB;
}
a:hover {
  border-bottom: 1px solid;
}
</style>
