<script setup lang="ts">
const { data, pending, error, refresh } = useAsyncData(
  "test",
  () =>
    new Promise((resolve) => {
      console.log("fetching data...");
      setTimeout(() => {
        resolve("Hello World");
      }, 1000);
    }), {
      deduplication: true
    }
);
useAsyncData(
  "test",
  () =>
    new Promise((resolve) => {
      console.log("fetching data...");
      setTimeout(() => {
        resolve("Hello World");
      }, 1000);
    }), {
      deduplication: true
    }
);
useAsyncData(
  "test",
  () =>
    new Promise((resolve) => {
      console.log("fetching data...");
      setTimeout(() => {
        resolve("Hello World");
      }, 1000);
    }), {
      deduplication: true
    }
);
useAsyncData(
  "test",
  () =>
    new Promise((resolve) => {
      console.log("fetching data...");
      setTimeout(() => {
        resolve("Hello World");
      }, 1000);
    }), {
      deduplication: true
    }
);
useAsyncData(
  "test",
  () =>
    new Promise((resolve) => {
      console.log("fetching data...");
      setTimeout(() => {
        resolve("Hello World");
      }, 1000);
    }), {
      deduplication: true
    }
);
useAsyncData(
  "test",
  () =>
    new Promise((resolve) => {
      console.log("fetching data...");
      setTimeout(() => {
        resolve("Hello World");
      }, 1000);
    }), {
      deduplication: true
    }
);
</script>

<template>
  <!-- Edit this file to play around with Nuxt but never commit changes! -->
  <div>Nuxt 3 Playground {{ data }}</div>
</template>

<style scoped></style>
