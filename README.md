[![Nuxt banner](./.github/assets/banner.svg)](https://nuxt.com)

# Nuxt

<p>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://img.shields.io/npm/v/nuxt.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="Version"></a>
  <a href="https://www.npmjs.com/package/nuxt"><img src="https://img.shields.io/npm/dm/nuxt.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="Downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/github/license/nuxt/nuxt.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="License"></a>
  <a href="https://nuxt.com"><img src="https://img.shields.io/badge/Nuxt%20Docs-18181B?logo=nuxt.js" alt="Website"></a>
  <a href="https://chat.nuxt.dev"><img src="https://img.shields.io/badge/Nuxt%20Discord-18181B?logo=discord" alt="Discord"></a>
</p>

Nuxt is a free and open-source framework with an intuitive and extendable way to create type-safe, performant and production-grade full-stack web applications and websites with Vue.js.

It provides a number of features that make it easy to build fast, SEO-friendly, and scalable web applications, including:
- Server-side rendering, Static Site Generation, Hybrid Rendering and Edge-Side Rendering
- Automatic routing with code-splitting and pre-fetching
- Data fetching and state management
- SEO Optimization and Meta tags definition
- Auto imports of components, composables and utils
- TypeScript with zero configuration
- Go fullstack with our server/ directory
- Extensible with [200+ modules](https://nuxt.com/modules)
- Deployment to a variety of [hosting platforms](https://nuxt.com/deploy)
- ...[and much more](https://nuxt.com) 🚀

### Table of Contents

- 🚀 [Getting Started](#getting-started)
- 💻 [ Vue Development](#vue-development)
- 📖 [Documentation](#documentation)
- 🧩 [Modules](#modules)
- ❤️  [Contribute](#contribute)
- 🏠 [Local Development](#local-development)
- ⛰️ [Nuxt 2](#nuxt-2)
- 🔗 [Follow us](#follow-us)
- ⚖️ [License](#license)

---

## <a name="getting-started">🚀 Getting Started</a>

Use the following command to create a new starter project. This will create a starter project with all the necessary files and dependencies:

```bash
npx nuxi@latest init <my-project>
```

> [!TIP]
> Discover also [nuxt.new](https://nuxt.new): Open a Nuxt starter on CodeSandbox, StackBlitz or locally to get up and running in a few seconds.

## <a name="vue-development">💻 Vue Development</a>

Simple, intuitive and powerful, Nuxt lets you write Vue components in a way that makes sense. Every repetitive task is automated, so you can focus on writing your full-stack Vue application with confidence.

Example of an `app.vue`:

```vue
<script setup lang="ts">
useSeoMeta({
  title: 'Meet Nuxt',
  description: 'The Intuitive Vue Framework.'
})
</script>

<template>
  <div id="app">
    <AppHeader />
    <NuxtPage />
    <AppFooter />
  </div>
</template>

<style scoped>
#app {
  background-color: #020420;
  color: #00DC82;
}
</style>
```

## <a name="documentation">📖 Documentation</a>

We highly recommend you take a look at the [Nuxt documentation](https://nuxt.com/docs) to level up. It’s a great resource for learning more about the framework. It covers everything from getting started to advanced topics.

## <a name="modules">🧩 Modules</a>

Discover our [list of modules](https://nuxt.com/modules) to supercharge your Nuxt project, created by the Nuxt team and community.

## <a name="contribute">❤️ Contribute</a>

We invite you to contribute and help improve Nuxt 💚

Here are a few ways you can get involved:
- **Reporting Bugs:** If you come across any bugs or issues, please check out the [reporting bugs guide](https://nuxt.com/docs/community/reporting-bugs) to learn how to submit a bug report.
- **Suggestions:** Have ideas to enhance Nuxt? We'd love to hear them! Check out the [contribution guide](https://nuxt.com/docs/community/contribution#creating-an-issue) to share your suggestions.
- **Questions:** If you have questions or need assistance, the [getting help guide](https://nuxt.com/docs/community/getting-help) provides resources to help you out.

## <a name="local-development">🏠 Local Development</a>

Follow the docs to [Set Up Your Local Development Environment](https://nuxt.com/docs/community/framework-contribution#setup) to contribute to the framework and documentation.

## <a name="nuxt-2">⛰️ Nuxt 2</a>

You can find the code for Nuxt 2 on the [`2.x` branch](https://github.com/nuxt/nuxt/tree/2.x) and the documentation at [v2.nuxt.com](https://v2.nuxt.com).

## <a name="follow-us">🔗 Follow us</a>

<p valign="center">
  <a href="https://chat.nuxt.dev"><img width="20px" src="./.github/assets/discord.svg" alt="Discord"></a>&nbsp;&nbsp;<a href="https://twitter.nuxt.dev"><img width="20px" src="./.github/assets/twitter.svg" alt="Twitter"></a>&nbsp;&nbsp;<a href="https://github.nuxt.dev"><img width="20px" src="./.github/assets/github.svg" alt="GitHub"></a>
</p>

## <a name="license">⚖️ License</a>

[MIT](./LICENSE)
