<script setup lang="ts">
const props = defineProps<{ product: Product }>()

const price = computed(() => `$${(props.product.price / 100).toFixed(2)}`)
</script>

<template>
  <article class="product-card">
    <h2>
      <NuxtLink :to="`/product/${props.product.id}`">
        {{ props.product.name }}
      </NuxtLink>
    </h2>
    <p>{{ props.product.description }}</p>
    <ul>
      <li
        v-for="tag in props.product.tags"
        :key="tag"
      >
        <NuxtLink :to="{ path: '/catalog', query: { tag } }">
          {{ tag }}
        </NuxtLink>
      </li>
    </ul>
    <ProductRating :rating="props.product.ratings" />
    <span class="price">{{ price }}</span>
    <ClientOnly>
      <button>Add to cart</button>
    </ClientOnly>
  </article>
</template>
