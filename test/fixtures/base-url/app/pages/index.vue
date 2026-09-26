<template>
  <div>
    <div data-testid="path">
      {{ $route.path }}
    </div>
    <NuxtLink to="/other">other</NuxtLink>
    <NuxtLink to="/prerendered">prerendered</NuxtLink>
  </div>
</template>
