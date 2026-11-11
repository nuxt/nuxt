<script setup lang="ts">
const products = [
  { sku: 'tea', name: 'Green tea', inStock: true },
  { sku: 'coffee', name: 'Coffee beans', inStock: true },
  { sku: 'cocoa', name: 'Cocoa', inStock: false },
]
const cart = useCart()

/**
 * Add one of a product to the cart. Use when the user wants to buy something.
 * @tool
 */
function addToCart (sku: string) {
  cart.value.push(sku)
  return `Added ${sku}. The cart has ${cart.value.length} items.`
}

/**
 * Empty the cart. Use when the user wants to start over.
 * @tool confirm
 */
function clearCart () {
  cart.value = []
}
</script>

<template>
  <div>
    <ProductSearch :products="products" />
    <ul>
      <li
        v-for="product in products"
        :key="product.sku"
      >
        {{ product.name }}
        <button
          :disabled="!product.inStock"
          @click="addToCart(product.sku)"
        >
          Add
        </button>
      </li>
    </ul>
    <p data-testid="cart">
      {{ cart.join(',') }}
    </p>
    <button
      data-testid="clear"
      @click="clearCart"
    >
      Clear cart
    </button>
    <NuxtLink to="/contact">
      Contact
    </NuxtLink>
  </div>
</template>
