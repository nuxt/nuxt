<template>
  <div>
    <h1>Scripted index</h1>
    <NuxtLink
      id="link-no-scripts"
      to="/no-scripts"
    >
      No scripts
    </NuxtLink>
    <NuxtLink
      id="link-aliased"
      to="/aliased"
    >
      Aliased (noScripts)
    </NuxtLink>
    <NuxtLink
      id="link-aliased-alt"
      to="/aliased-alt"
    >
      Aliased alt (scripted)
    </NuxtLink>
    <NuxtLink
      id="link-product"
      to="/products/123"
    >
      Product 123
    </NuxtLink>
  </div>
</template>
