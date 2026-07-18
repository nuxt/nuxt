---
navigation.title: 'Dev Containers'
title: Dev Containers
description: Open your Nuxt project in a dev container for a consistent development environment.
---

This project includes a dev container configuration, giving you a consistent development environment with all dependencies pre-installed.

::read-more{to="https://code.visualstudio.com/docs/devcontainers/containers" target="_blank"}
Read more about dev containers
::

## Options to Open in a Dev Container

### 1. VS Code Prompt

When you open the project in VS Code, you should see a notification in the bottom right corner:

**"Reopen in Dev Containers"**

Click this button to build and open the project in a dev container.


### 2. Command Palette

If you dismiss the prompt or want to manually trigger it:

1. Open the Command Palette (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)
2. Search for **"Dev Containers: Reopen in Container"**
3. Select it

VS Code will build the container and reopen your project.

### 3. Dev Containers CLI

For advanced users or CI workflows, you can use the Dev Containers CLI directly:

```bash
# Install the CLI (if not already installed)
npm install -g @devcontainers/cli

# Build and open the project in a container
devcontainer up

# After making changes to .devcontainer, rebuild
devcontainer build
```

To attach to an already-running container:

```bash
devcontainer open --workspace-folder .
```

## What's Included

The dev container comes pre-configured with:

- **Node.js LTS** with corepack (pnpm enabled)
- **VS Code extensions**: Vue (Volar), Docker, ESLint, GitHub Actions
- **Port 3000** forwarded for the Nuxt dev server
- **node_modules** persisted in a Docker volume

## Next Steps

Once the container is running:

```bash
pnpm dev
```

Your Nuxt app will be available at <http://localhost:3000>.

