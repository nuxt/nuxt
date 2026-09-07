<template>
  <div>
    <h1 id="index-page">
      Server-rendered index
    </h1>
    <NuxtLink
      id="link-admin"
      to="/admin"
    >
      Admin
    </NuxtLink>
    <NuxtLink
      id="link-admin-ssr"
      to="/admin/ssr"
    >
      Admin (SSR)
    </NuxtLink>
    <NuxtLink
      id="link-product"
      to="/products/123"
    >
      Product 123
    </NuxtLink>
  </div>
</template>
