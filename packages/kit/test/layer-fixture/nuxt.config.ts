export default defineNuxtConfig({
  extends: ['./custom-layers/b', './custom-layers/a'],
  $meta: {
    name: 'layer-fixture',
  },
})
