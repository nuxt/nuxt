<template>
  <v-carousel>
    <v-carousel-item v-for="(src, i) in images" :key="i" :src="src" />
  </v-carousel>
</template>

<script>
export default {
  data: () => ({
    images: [
      'https://cdn.vuetifyjs.com/images/carousel/squirrel.jpg',
      'https://cdn.vuetifyjs.com/images/carousel/sky.jpg',
      'https://cdn.vuetifyjs.com/images/carousel/bird.jpg',
      'https://cdn.vuetifyjs.com/images/carousel/planet.jpg'
    ]
  })
}
</script>
