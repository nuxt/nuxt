---
navigation.title: 'Dev Containers'
title: Dev Containers
description: Set up or open a Nuxt project in a dev container for a consistent development environment.
---

## Setting Up a Dev Container

If you're starting a new Nuxt project and want to develop inside a dev container, you can add the configuration yourself.

::read-more{to="https://code.visualstudio.com/docs/devcontainers/containers" target="_blank"}
Read more about dev containers
::

### Prerequisites

- [Visual Studio Code](https://code.visualstudio.com/) with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Docker Engine](https://docs.docker.com/engine/)

### Create the Configuration

Create a `.devcontainer/` folder in your project root with these two files:

```json [devcontainer.json]
{
  "name": "nuxt-devcontainer",
  "build": {
    "dockerfile": "Dockerfile",
    "context": "../"
  },
  "forwardPorts": [3000],
  "portsAttributes": {
    "3000": {
      "label": "Application",
      "onAutoForward": "openPreview"
    }
  },
  "mounts": [
    "type=volume,target=${containerWorkspaceFolder}/node_modules"
  ],
  "postStartCommand": "pnpm install && pnpm dev:prepare"
}
```

```dockerfile [Dockerfile]
FROM node:lts

WORKDIR /app

RUN npm i -g corepack && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml  ./
RUN pnpm install --frozen-lockfile

COPY . .
```

This configuration uses Node.js LTS and enables pnpm via corepack. It forwards port 3000 for the Nuxt dev server and persists `node_modules` in a Docker volume to avoid reinstallation on container restarts.

::tip
To use a different package manager, replace `corepack enable` with your preferred manager (for example, `npm install -g yarn`) and update the `postStartCommand` accordingly.
::

## Opening an Existing Dev Container

If a project already includes a dev container configuration, you can open it using any of these methods:

### 1. VS Code Prompt

When you open the project in VS Code, you should see a notification in the bottom right corner:

> "Reopen in Dev Containers"

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
devcontainer up --workspace-folder .

# After making changes to .devcontainer, rebuild
devcontainer build
```

## Next Steps

Once the container is running:

```bash
pnpm dev
```

Your Nuxt app will be available at <http://localhost:3000>.
