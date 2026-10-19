<script setup lang="ts">
const CASES: Record<string, { rows: number, clients: number, slots: number }> = {
  s: { rows: 10, clients: 0, slots: 0 },
  m: { rows: 200, clients: 5, slots: 2 },
  l: { rows: 2000, clients: 20, slots: 5 },
  c: { rows: 50, clients: 50, slots: 0 },
  sl: { rows: 50, clients: 0, slots: 20 },
}
const route = useRoute()
const cfg = CASES[route.params.c as string] ?? CASES.s!
const island = ref<{ refresh: () => Promise<void> } | null>(null)
if (import.meta.client) {
  (window as any).__benchCfg = cfg;
  (window as any).__benchRefresh = async () => {
    const t0 = performance.now()
    await island.value?.refresh()
    await nextTick()
    return performance.now() - t0
  }
}
</script>

<template>
  <div>
    <h1>bench {{ route.params.c }}</h1>
    <BenchIsland ref="island" :rows="cfg.rows" :clients="cfg.clients" :slots="cfg.slots">
      <template v-for="s in cfg.slots" :key="s" #[`s${s}`]>
        <p class="slot">slot {{ s }}</p>
      </template>
    </BenchIsland>
  </div>
</template>
