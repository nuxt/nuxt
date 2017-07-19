<template>
  <v-carousel>
    <v-carousel-item v-for="(src, i) in images" v-bind:src="src" :key="i"></v-carousel-item>
  </v-carousel>
</template>

<script>
export default {
  data: () => ({
    images: [
      'https://vuetifyjs.com/static/doc-images/carousel/squirrel.jpg',
      'https://vuetifyjs.com/static/doc-images/carousel/sky.jpg',
      'https://vuetifyjs.com/static/doc-images/carousel/bird.jpg',
      'https://vuetifyjs.com/static/doc-images/carousel/planet.jpg'
    ]
  })
}
</script>