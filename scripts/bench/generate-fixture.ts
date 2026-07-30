/**
 * Generates a synthetic Nuxt app of a configurable size for dev-server benchmarking.
 *
 * The playground is a single `app.vue`, which hides every cost that scales with
 * app size (template generation, module graph traversal, auto-import scanning,
 * optimizeDeps discovery). These fixtures are deliberately shaped like a real
 * mid-to-large app so those costs show up.
 *
 * Usage: node scripts/bench/generate-fixture.ts --size medium --out .bench/medium
 */
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

export interface FixtureSize {
  components: number
  pages: number
  composables: number
  layouts: number
  serverRoutes: number
  /** components imported by each page */
  fanout: number
  /** css files imported by components */
  cssFiles: number
  /**
   * Synthetic CJS packages written into the fixture's `node_modules`.
   *
   * Without these the fixture has no bare imports for Vite to prebundle, which
   * hides `optimizeDeps` entirely. On a real app dependency prebundling is one
   * of the largest first-start costs and the usual cause of a mid-session full
   * page reload, so it has to be represented.
   */
  deps: number
  /** modules per synthetic dependency */
  depModules: number
}

export const SIZES: Record<string, FixtureSize> = {
  tiny: { components: 5, pages: 3, composables: 2, layouts: 1, serverRoutes: 2, fanout: 2, cssFiles: 1, deps: 0, depModules: 0 },
  small: { components: 40, pages: 15, composables: 10, layouts: 2, serverRoutes: 8, fanout: 4, cssFiles: 5, deps: 10, depModules: 5 },
  medium: { components: 200, pages: 60, composables: 40, layouts: 3, serverRoutes: 30, fanout: 8, cssFiles: 20, deps: 40, depModules: 10 },
  large: { components: 800, pages: 200, composables: 120, layouts: 5, serverRoutes: 80, fanout: 12, cssFiles: 60, deps: 120, depModules: 20 },
}

function write (path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function componentName (i: number) {
  return `Widget${String(i).padStart(4, '0')}`
}

/**
 * A dev server that has only just been signalled can still be writing into
 * `.nuxt`, which makes a recursive remove fail with ENOTEMPTY. A half-generated
 * fixture produces a benchmark that looks fast because most of the app is
 * missing, so this retries rather than letting the caller continue.
 */
function removeFixtureDir (outDir: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      rmSync(outDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
      return
    } catch (error) {
      if (attempt >= 10) { throw error }
      const until = Date.now() + 500
      while (Date.now() < until) { /* busy wait: this script is sync throughout */ }
    }
  }
}

export function generateFixture (outDir: string, size: FixtureSize, options: { nuxtConfig?: string } = {}) {
  removeFixtureDir(outDir)
  mkdirSync(outDir, { recursive: true })

  write(resolve(outDir, 'package.json'), JSON.stringify({
    name: `bench-fixture-${size.components}`,
    private: true,
    type: 'module',
    dependencies: {
      nuxt: 'workspace:*',
      ...Object.fromEntries(Array.from({ length: size.deps }, (_, d) => [`bench-dep-${d}`, '1.0.0'])),
    },
  }, null, 2))

  write(resolve(outDir, 'nuxt.config.ts'), options.nuxtConfig ?? [
    'export default defineNuxtConfig({',
    '  compatibilityDate: \'latest\',',
    '  devtools: { enabled: false },',
    '  telemetry: false,',
    '})',
    '',
  ].join('\n'))

  write(resolve(outDir, 'tsconfig.json'), JSON.stringify({ extends: './.nuxt/tsconfig.json' }, null, 2))

  // Nitro resolves its auto-import presets from the fixture's own module tree.
  // Without a local `node_modules/nuxt` the nitro imports are silently skipped
  // and every `defineEventHandler` in `server/` throws at request time.
  const nuxtPkg = resolve(outDir, 'node_modules/nuxt')
  mkdirSync(dirname(nuxtPkg), { recursive: true })
  try {
    symlinkSync(relative(dirname(nuxtPkg), resolve(import.meta.dirname, '../../packages/nuxt')), nuxtPkg, 'dir')
  } catch { /* best effort */ }

  generateDeps(outDir, size)

  for (let i = 0; i < size.cssFiles; i++) {
    const rules = Array.from({ length: 40 }, (_, r) =>
      `.bench-${i}-${r} { color: #${(i * 40 + r).toString(16).padStart(6, '0')}; padding: ${r}px; }`).join('\n')
    write(resolve(outDir, `app/assets/css/bench-${i}.css`), rules)
  }

  for (let i = 0; i < size.composables; i++) {
    write(resolve(outDir, `app/composables/useBench${i}.ts`), [
      `export function useBench${i} () {`,
      `  const state = useState(${JSON.stringify(`bench-${i}`)}, () => ({ count: ${i}, label: 'bench-${i}' }))`,
      `  const doubled = computed(() => state.value.count * 2)`,
      `  return { state, doubled }`,
      `}`,
      '',
    ].join('\n'))
  }

  for (let i = 0; i < size.components; i++) {
    const name = componentName(i)
    const composable = size.composables ? `useBench${i % size.composables}` : undefined
    const dep = size.deps ? `bench-dep-${i % size.deps}` : undefined
    const css = size.cssFiles ? `@import '~/assets/css/bench-${i % size.cssFiles}.css';` : ''
    const children = Array.from({ length: Math.min(3, size.components - 1) }, (_, c) => componentName((i + c + 1) % size.components))
    write(resolve(outDir, `app/components/${name}.vue`), [
      '<script setup lang="ts">',
      dep ? `import { compute as depCompute } from '${dep}'` : '',
      `const props = defineProps<{ depth?: number }>()`,
      composable ? `const { state, doubled } = ${composable}()` : '',
      `const local = ref(${i})`,
      `const derived = computed(() => local.value + (props.depth ?? 0)${composable ? ' + doubled.value' : ''}${dep ? ` + depCompute(${i})` : ''})`,
      '</script>',
      '',
      '<template>',
      `  <div class="widget bench-${i % Math.max(1, size.cssFiles)}-1">`,
      // stable marker the benchmark rewrites to measure hot-update latency
      `    <span class="hmr-marker">seed</span>`,
      `    <span>${name}: {{ derived }}</span>`,
      composable ? `    <span>{{ state.label }}</span>` : '',
      ...(i % 7 === 0 ? children.map(c => `    <${c} v-if="(props.depth ?? 0) < 1" :depth="(props.depth ?? 0) + 1" />`) : []),
      '  </div>',
      '</template>',
      '',
      '<style scoped>',
      css,
      `.widget { display: flex; gap: 4px; border: 1px solid #${(i % 4096).toString(16).padStart(3, '0')}; }`,
      '</style>',
      '',
    ].filter(Boolean).join('\n'))
  }

  for (let l = 0; l < size.layouts; l++) {
    write(resolve(outDir, `app/layouts/${l === 0 ? 'default' : `alt${l}`}.vue`), [
      '<template>',
      `  <div class="layout-${l}">`,
      '    <slot />',
      '  </div>',
      '</template>',
      '',
    ].join('\n'))
  }

  for (let p = 0; p < size.pages; p++) {
    const used = Array.from({ length: size.fanout }, (_, f) => componentName((p * size.fanout + f) % Math.max(1, size.components)))
    write(resolve(outDir, `app/pages/${p === 0 ? 'index' : `page-${p}`}.vue`), [
      '<script setup lang="ts">',
      `definePageMeta({ layout: ${JSON.stringify(size.layouts > 1 && p % 3 === 1 ? 'alt1' : 'default')} })`,
      `const { data } = await useAsyncData('page-${p}', () => Promise.resolve({ id: ${p} }))`,
      '</script>',
      '',
      '<template>',
      `  <div>`,
      `    <span class="hmr-page-marker">seed</span>`,
      `    <h1>Page ${p} - {{ data?.id }}</h1>`,
      ...used.map(c => `    <${c} />`),
      '  </div>',
      '</template>',
      '',
    ].join('\n'))
  }

  for (let s = 0; s < size.serverRoutes; s++) {
    // explicit import rather than the nitro auto-import: the fixture has to
    // keep working regardless of whether server auto-imports are wired up
    write(resolve(outDir, `server/api/bench-${s}.ts`), [
      `import { defineHandler } from 'h3'`,
      '',
      `export default defineHandler(() => ({ route: ${s}, at: Date.now() }))`,
      '',
    ].join('\n'))
  }

  write(resolve(outDir, 'app/app.vue'), [
    '<template>',
    '  <NuxtLayout>',
    '    <NuxtPage />',
    '  </NuxtLayout>',
    '</template>',
    '',
  ].join('\n'))

  return outDir
}

/**
 * Writes plain-CJS packages into the fixture's `node_modules`. CJS is what
 * forces Vite to prebundle rather than serve the source directly, so this is
 * what actually exercises the `optimizeDeps` path.
 */
function generateDeps (outDir: string, size: FixtureSize) {
  for (let d = 0; d < size.deps; d++) {
    const name = `bench-dep-${d}`
    const root = resolve(outDir, 'node_modules', name)
    write(resolve(root, 'package.json'), JSON.stringify({
      name,
      version: '1.0.0',
      main: 'index.js',
    }, null, 2))

    const submodules = Array.from({ length: size.depModules }, (_, m) => `mod${m}`)
    write(resolve(root, 'index.js'), [
      ...submodules.map(m => `const ${m} = require('./${m}.js')`),
      `exports.compute = function compute (n) {`,
      `  return ${submodules.length ? submodules.map(m => `${m}.value(n)`).join(' + ') : 'n'}`,
      `}`,
      `exports.name = ${JSON.stringify(name)}`,
      '',
    ].join('\n'))

    for (let m = 0; m < size.depModules; m++) {
      // enough body to make prebundling non-trivial rather than instant
      const helpers = Array.from({ length: 20 }, (_, h) =>
        `function helper${h} (x) { return (x * ${h + 1}) % 97 }`).join('\n')
      write(resolve(root, `mod${m}.js`), [
        helpers,
        `exports.value = function value (n) {`,
        `  return ${Array.from({ length: 20 }, (_, h) => `helper${h}(n)`).join(' + ')}`,
        `}`,
        '',
      ].join('\n'))
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const get = (flag: string, fallback?: string) => {
    const i = args.indexOf(flag)
    return i === -1 ? fallback : args[i + 1]
  }
  const sizeName = get('--size', 'medium')!
  const size = SIZES[sizeName]
  if (!size) {
    console.error(`Unknown size "${sizeName}". Available: ${Object.keys(SIZES).join(', ')}`)
    process.exit(1)
  }
  const out = resolve(process.cwd(), get('--out', `.bench/${sizeName}`)!)
  generateFixture(out, size)
  console.log(`Generated ${sizeName} fixture at ${out}`)
  console.log(`  ${size.components} components, ${size.pages} pages, ${size.composables} composables, ${size.serverRoutes} server routes, ${size.deps} cjs deps`)
}
