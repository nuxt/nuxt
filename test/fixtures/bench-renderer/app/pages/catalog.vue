<script setup lang="ts">
const { data: products } = await useAsyncData('products', () => Promise.resolve(createProducts(100)))
const { data: featured } = await useAsyncData('featured', () => Promise.resolve(createProducts(5)))
const filter = useState('filter', () => ({ tag: null as string | null, sort: 'price' }))

useHead({
  title: 'Catalog',
  link: [{ rel: 'canonical', href: 'https://example.com/catalog' }],
})
useSeoMeta({
  description: 'Browse every product in the catalog.',
  ogTitle: 'Catalog',
  ogDescription: 'Browse every product in the catalog.',
  ogImage: 'https://example.com/og.png',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div>
    <h1>Catalog ({{ filter.sort }})</h1>
    <section class="featured">
      <ProductCard
        v-for="product in featured"
        :key="product.id"
        :product="product"
      />
    </section>
    <section class="products">
      <ProductCard
        v-for="product in products"
        :key="product.id"
        :product="product"
      />
    </section>
  </div>
</template>
