<template>
  <div>
    <div class="placeholder-to-ensure-no-override">
      this should not be removed by hydration
    </div>
    <ClientFragmentServer />

    <div class="placeholder-to-ensure-no-override">
      this should not be removed by hydration
    </div>
    <ClientServerFragment />

    <div class="placeholder-to-ensure-no-override">
      this should not be removed by hydration
    </div>
    <ClientServer />

    <div class="placeholder-to-ensure-no-override">
      this should not be removed by hydration
    </div>

    <ClientFragmentServerFragment />

    <div class="placeholder-to-ensure-no-override">
      this should not be removed by hydration
    </div>
  </div>
</template>
