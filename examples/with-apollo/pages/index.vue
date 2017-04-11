<template>
  <div>
    <h3>Cars</h3>
    <ul>
      <li v-for="car in cars">
        <nuxt-link :to="`car/${car.id}`">
          {{ car.year }} {{ car.make }} {{ car.model }}
        </nuxt-link>
      </li>
    </ul>
  </div>
</template>

<script>
import client from '~plugins/apollo'
import gql from 'graphql-tag'

export default {

  async asyncData() {
    let { data } = await client.query({
      query: gql`
        query {
          allCars {
            id
            make
            model
            year
          }
        }
      `
    })
    return {
      cars: data.allCars
    }
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
