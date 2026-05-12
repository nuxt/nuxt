<a href="https://nuxt.com"><img width="830" height="213" src="./.github/assets/banner.svg" alt="Nuxt banner"></a>

# Nuxt

<p>
  <a href="https://npmx.dev/package/nuxt"><img src="https://npmx.dev/api/registry/badge/version/nuxt" alt="Version"></a>
  <a href="https://npmx.dev/package/nuxt"><img src="https://npmx.dev/api/registry/badge/downloads/nuxt" alt="Downloads"></a>
  <a href="https://github.com/nuxt/nuxt/blob/main/LICENSE"><img src="https://img.shields.io/github/license/nuxt/nuxt.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="License"></a>
  <a href="https://nuxt.com/modules"><img src="https://img.shields.io/badge/dynamic/json?url=https://nuxt.com/api/v1/modules&query=$.stats.modules&label=Modules&style=flat&colorA=18181B&colorB=28CF8D" alt="Modules"></a>
  <a href="https://nuxt.com"><img src="https://img.shields.io/badge/Nuxt%20Docs-18181B?logo=nuxt" alt="Website"></a>
  <a href="https://chat.nuxt.dev"><img src="https://img.shields.io/badge/Nuxt%20Discord-18181B?logo=discord" alt="Discord"></a>
</p>

Nuxt 是一个免费的开源框架，提供直观且可扩展的方式来创建类型安全、高性能和生产级的全栈 Web 应用程序和网站。

## 特性

- 🚀 **快速开发**：即时服务器启动和热模块替换
- 📱 **响应式设计**：内置响应式支持
- 🔍 **SEO 友好**：服务器端渲染和静态站点生成
- 🎨 **自动导入**：自动导入组件、组合式函数和工具函数
- 🔧 **TypeScript 支持**：零配置 TypeScript 支持
- 📦 **自动代码分割**：自动代码分割和预取
- 🗂️ **文件系统路由**：基于文件系统的自动路由
- 🔌 **模块系统**：丰富的模块生态系统
- 🛡️ **安全**：内置安全最佳实践

## 安装

### 使用 npx

```bash
npx nuxi@latest init my-app
```

### 使用 yarn

```bash
yarn dlx nuxi@latest init my-app
```

### 使用 pnpm

```bash
pnpm dlx nuxi@latest init my-app
```

## 快速开始

### 创建项目

```bash
npx nuxi@latest init my-app
cd my-app
npm install
npm run dev
```

### 基本页面

```vue
<!-- pages/index.vue -->
<template>
  <div>
    <h1>欢迎来到 Nuxt</h1>
    <p>这是一个基本的 Nuxt 页面</p>
  </div>
</template>

<script setup>
const title = '我的 Nuxt 应用'

useHead({
  title: title
})
</script>
```

### 布局

```vue
<!-- layouts/default.vue -->
<template>
  <div>
    <header>
      <nav>
        <NuxtLink to="/">首页</NuxtLink>
        <NuxtLink to="/about">关于</NuxtLink>
      </nav>
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <p>版权所有 © 2024</p>
    </footer>
  </div>
</template>
```

### 组件

```vue
<!-- components/MyComponent.vue -->
<template>
  <div class="my-component">
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
const props = defineProps({
  title: String,
  description: String
})
</script>
```

### 组合式函数

```javascript
// composables/useCounter.js
export const useCounter = () => {
  const count = useState('count', () => 0)
  
  const increment = () => {
    count.value++
  }
  
  const decrement = () => {
    count.value--
  }
  
  return {
    count,
    increment,
    decrement
  }
}
```

### 数据获取

```vue
<template>
  <div>
    <h1>{{ data.title }}</h1>
    <p>{{ data.description }}</p>
  </div>
</template>

<script setup>
const { data } = await useFetch('/api/posts/1')
</script>
```

### API 路由

```javascript
// server/api/hello.js
export default defineEventHandler((event) => {
  return {
    message: 'Hello World!'
  }
})
```

## 渲染模式

### 服务器端渲染 (SSR)

```javascript
// nuxt.config.js
export default defineNuxtConfig({
  ssr: true
})
```

### 静态站点生成 (SSG)

```bash
npm run generate
```

### 客户端渲染 (CSR)

```javascript
// nuxt.config.js
export default defineNuxtConfig({
  ssr: false
})
```

### 混合渲染

```javascript
// nuxt.config.js
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },
  }
})
```

## 状态管理

### 使用 useState

```vue
<script setup>
const counter = useState('counter', () => 0)

const increment = () => {
  counter.value++
}
</script>

<template>
  <div>
    <p>计数: {{ counter }}</p>
    <button @click="increment">增加</button>
  </div>
</template>
```

### 使用 Pinia

```bash
npm install @pinia/nuxt
```

```javascript
// nuxt.config.js
export default defineNuxtConfig({
  modules: ['@pinia/nuxt']
})
```

```javascript
// stores/counter.js
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', {
  state: () => ({
    count: 0
  }),
  actions: {
    increment() {
      this.count++
    }
  }
})
```

## 模块

### 官方模块

- [@nuxt/ui](https://github.com/nuxt/ui) - UI 组件库
- [@nuxt/content](https://github.com/nuxt/content) - 内容管理系统
- [@nuxt/image](https://github.com/nuxt/image) - 图片优化
- [@nuxt/fonts](https://github.com/nuxt/fonts) - 字体优化
- [@nuxt/icon](https://github.com/nuxt/icon) - 图标系统

### 使用模块

```javascript
// nuxt.config.js
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    '@nuxt/content',
    '@nuxt/image'
  ]
})
```

## 部署

### 静态部署

```bash
npm run generate
# 将 .output/public 目录部署到静态托管服务
```

### Node.js 服务器

```bash
npm run build
node .output/server/index.mjs
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

## 与 Next.js 的比较

| 特性 | Nuxt | Next.js |
|------|------|---------|
| 框架 | Vue.js | React |
| 渲染模式 | SSR/SSG/CSR/混合 | SSR/SSG/CSR/混合 |
| 文件系统路由 | 是 | 是 |
| 自动导入 | 是 | 是 |
| TypeScript 支持 | 是 | 是 |
| 模块系统 | 是 | 否 |
| 学习曲线 | 低 | 中等 |

## 与 Vue CLI 的比较

| 特性 | Nuxt | Vue CLI |
|------|------|---------|
| SSR 支持 | 内置 | 需要配置 |
| 文件系统路由 | 是 | 否 |
| 自动导入 | 是 | 否 |
| 静态站点生成 | 是 | 是 |
| 服务器端渲染 | 是 | 需要配置 |
| 学习曲线 | 低 | 中等 |

## 最佳实践

### 1. 使用组合式函数

```javascript
// composables/useApi.js
export const useApi = () => {
  const config = useRuntimeConfig()
  
  const fetchApi = async (endpoint) => {
    const response = await $fetch(`${config.public.apiBase}${endpoint}`)
    return response
  }
  
  return {
    fetchApi
  }
}
```

### 2. 使用中间件

```javascript
// middleware/auth.js
export default defineNuxtRouteMiddleware((to, from) => {
  const isAuthenticated = useState('isAuthenticated')
  
  if (!isAuthenticated.value && to.path !== '/login') {
    return navigateTo('/login')
  }
})
```

### 3. 使用插件

```javascript
// plugins/analytics.js
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('page:finish', () => {
    // 页面加载完成后的分析逻辑
  })
})
```

## 性能优化

### 1. 使用预取

```vue
<template>
  <NuxtLink to="/about" prefetch>关于</NuxtLink>
</template>
```

### 2. 使用图片优化

```vue
<template>
  <NuxtImg src="/images/hero.jpg" width="800" height="600" />
</template>
```

### 3. 使用代码分割

```vue
<script setup>
const HeavyComponent = defineAsyncComponent(() => import('./HeavyComponent.vue'))
</script>
```

## 文档

完整文档请访问 [nuxt.com](https://nuxt.com)。

## 社区

如需帮助、讨论最佳实践或功能建议：

[在 Discord 上讨论 Nuxt](https://chat.nuxt.dev)

## 贡献

如果您有兴趣为 Nuxt 做出贡献，请在提交拉取请求之前阅读我们的[贡献文档](https://github.com/nuxt/nuxt/blob/main/CONTRIBUTING.md)。

## 许可证

MIT
