<template>
  <div>
    <h3>{{ car.make }} {{ car.model }}</h3>
    <p>{{ formatCurrency(car.price) }}</p>
    <img :src="car.photoURL" :alt="`${car.model} photo`">
  </div>
</template>

<script>
import client from '~plugins/apollo'
import gql from 'graphql-tag'

export default {

  async asyncData({ params }) {
    let { data } = await client.query({
      query: gql`
        query {
          Car(id: "${params.id}") {
            make
            model
            photoURL
            price
          }
        }
      `
    })
    return {
      car: data.Car
    }
  },

  methods: {
    formatCurrency(num) {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      })
      return formatter.format(num)
    }
  }

}
</script>

<style>

img {
  max-width: 600px;
}

</style>
