<template>
    <div><button @click="reloadNuxtApp()">EEE</button><C /> <NestedD /> <SuperNestedE /><div style="height: 3000px"/> <NuxtLink to="/second">EEEE</NuxtLink><NuxtLink to="/third">BBBB</NuxtLink></div>
</template>
<script setup lang="ts">
definePageMeta({
  layout: false
})</script>