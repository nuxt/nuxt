<template>
  <div>
    <div>
      should not be rendered on ssr
    </div>
    <NuxtLink to="/forbidden">
      should throw a 404 error
    </NuxtLink>
  </div>
</template>
