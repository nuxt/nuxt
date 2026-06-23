<template>
  <div>
    <h1 data-testid="title">
      Fouc
    </h1>

    <!-- A *nested* async component. `FoucNestedParent` resolves first, and only
         then renders the styled `FoucAsyncBlock`. Because that inner component
         is instantiated after the first chunk, the renderer emits its SFC
         `<style>` in the closing HTML — behind the component's own DOM. -->
    <Suspense>
      <FoucNestedParent :delay="100" />
      <template #fallback>
        <div class="skeleton">
          loading nested...
        </div>
      </template>
    </Suspense>

    <!-- A slow sibling holds the stream open, widening the window during which
         `flashy` is painted but still unstyled. -->
    <Suspense>
      <AsyncBlock
        name="slow"
        :delay="800"
        :progress="100"
      />
      <template #fallback>
        <div class="skeleton">
          loading slow...
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Fouc Test' })
</script>
