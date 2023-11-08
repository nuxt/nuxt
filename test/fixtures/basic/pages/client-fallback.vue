<template>
  <div>
    Hello World
    <div id="locator-for-playwright">
      <!-- single child -->
      <NuxtClientFallback fallback-tag="span" class="break-in-ssr" fallback="this failed to render">
        <BreakInSetup />
      </NuxtClientFallback>
      <!-- multi child -->
      <NuxtClientFallback>
        <BreakInSetup class="broke-in-ssr" />
        <BreakInSetup />
      </NuxtClientFallback>
      <!-- don't render if one child fails in ssr -->
      <NuxtClientFallback>
        <BreakInSetup />
        <SugarCounter id="sugar-counter" :multiplier="multiplier" />
      </NuxtClientFallback>
      <!-- nested children fails -->
      <NuxtClientFallback>
        <div>
          <BreakInSetup />
        </div>
        <SugarCounter :multiplier="multiplier" />
      </NuxtClientFallback>
      <!-- should be rendered -->
      <NuxtClientFallback fallback-tag="p">
        <FunctionalComponent />
      </NuxtClientFallback>
      <!-- fallback -->
      <NuxtClientFallback>
        <BreakInSetup />
        <template #fallback>
          <div>Hello world !</div>
        </template>
      </NuxtClientFallback>
      <ClientFallbackStateful />
      <ClientFallbackStatefulSetup />
      <ClientFallbackNonStatefulSetup />
      <ClientFallbackNonStateful />
      <ClientFallbackAsyncSetup />
      <NuxtClientFallback keep-fallback>
        <div>
          <BreakInSetup />
        </div>
        <template #fallback>
          <div id="keep-fallback">
            keep fallback in client
          </div>
        </template>
      </NuxtClientFallback>
    </div>
    <button id="increment-count" @click="multiplier++">
      increment count
    </button>
  </div>
</template>

<script setup>
const multiplier = ref(0)
</script>
