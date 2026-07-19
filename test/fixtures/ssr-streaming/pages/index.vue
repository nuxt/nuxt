<template>
  <div>
    <h1 data-testid="title">
      Streaming Home
    </h1>
    <p>
      <NuxtLink
        to="/async-head"
        data-testid="link-async"
      >async-head</NuxtLink>
      ·
      <NuxtLink to="/multi-async">
        multi-async
      </NuxtLink>
      ·
      <NuxtLink to="/buffered">
        buffered
      </NuxtLink>
      ·
      <NuxtLink to="/styled">
        styled
      </NuxtLink>
    </p>

    <Suspense>
      <AsyncBlock
        name="A"
        :delay="120"
        :progress="40"
      />
      <template #fallback>
        <div class="skeleton">
          loading A...
        </div>
      </template>
    </Suspense>

    <Suspense>
      <AsyncBlock
        name="B"
        :delay="320"
        :progress="100"
      />
      <template #fallback>
        <div class="skeleton">
          loading B...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Streaming Home' })
</script>
