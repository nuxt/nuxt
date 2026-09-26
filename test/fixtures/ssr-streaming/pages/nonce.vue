<template>
  <div
    class="nonce-probe"
    data-testid="title"
  >
    Nonce Page
    <Suspense>
      <AsyncBlock
        name="N"
        :delay="50"
        :progress="10"
      />
      <template #fallback>
        <div class="skeleton">
          loading N...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Nonce Page' })
</script>

<style>
.nonce-probe {
  color: rgb(1, 2, 3);
}
</style>
