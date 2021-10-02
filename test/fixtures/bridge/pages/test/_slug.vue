<template>
  <div>
    <nuxt-link :to="`/test/${Math.random() * 100}`">
      Random path
    </nuxt-link>
  </div>
</template>
