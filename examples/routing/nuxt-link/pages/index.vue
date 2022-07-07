<template>
  <div>
    <NuxtLink to="/about">
      About page
    </NuxtLink>
    <NuxtLink v-slot="{ navigate }" to="/about" custom>
      <button @click="navigate">
        Custom about page
      </button>
    </NuxtLink>
    <NuxtLink to="https://nuxtjs.org">
      Nuxt website
    </NuxtLink>
    <NuxtLink v-slot="{ href, target }" to="https://nuxtjs.org" custom>
      <a :href="href" :target="target">Go to {{ href }}</a>
    </NuxtLink>
    <NuxtLink to="https://twitter.com/nuxt_js" target="_blank">
      Nuxt Twitter with a blank target
    </NuxtLink>
    <NuxtLink to="https://discord.nuxtjs.org" target="_blank" rel="noopener">
      Nuxt Discord with a blank target and custom rel value
    </NuxtLink>
    <NuxtLink to="https://github.com/nuxt" no-rel>
      Nuxt GitHub without rel attribute
    </NuxtLink>
    <MyNuxtLink to="https://nuxtjs.org">
      Nuxt website with a custom link component with no default rel attribute
    </MyNuxtLink>
    <MyNuxtLink to="/">
      Index page with a custom link component with a custom active class
    </MyNuxtLink>
    <NuxtLink>Link without href and to</NuxtLink>
  </div>
</template>
