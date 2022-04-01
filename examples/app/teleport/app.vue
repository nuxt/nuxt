<template>
  <NuxtExampleLayout example="app/teleport">
    <div>
      <!-- SSR Teleport -->
      <Teleport to="body">
        SSR Teleport
      </Teleport>

      <!-- Client Teleport -->
      <ClientOnly>
        <Teleport to="body">
          <div>
            Hello from a client-side teleport!
          </div>
        </Teleport>
      </ClientOnly>

      <!-- Modal Example -->
      <MyModal />
    </div>
  </NuxtExampleLayout>
</template>
