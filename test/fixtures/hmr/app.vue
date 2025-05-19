<template>
  <NuxtLayout>
    <NuxtPage :key="() => $route.fullPath" />
  </NuxtLayout>
</template>
