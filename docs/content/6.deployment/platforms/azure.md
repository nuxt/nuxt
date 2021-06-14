# Azure Static Web Apps

> How to deploy Nuxt to Azure Static Web Apps with Nuxt Nitro.

 - Support for serverless SSR build
 - Auto-detected when deploying
 - Minimal configuration required

## Setup

Azure Static Web Apps are designed to be deployed continuously in a [GitHub Actions workflow](https://docs.microsoft.com/en-us/azure/static-web-apps/github-actions-workflow). By default, Nitro will detect this deployment environment and enable the `azure` preset.

## Deploy from CI/CD via GitHub Actions

When you link your GitHub repository to Azure Static Web Apps, a workflow file is added to the repository.

Find the build configuration section in this workflow and update the build configuration:

```yml{}[.github/workflows/azure-static-web-apps-<RANDOM_NAME>.yml]
###### Repository/Build Configurations ######
app_location: '/'
api_location: '.output/server'
output_location: '.output/public'
###### End of Repository/Build Configurations ######
```

**Note**

Pending an update in the [Azure Static Web Apps workflow](https://github.com/Azure/static-web-apps-deploy), you will also need to run the following in your root directory:
```bash
mkdir -p .output/server
touch .output/server/.gitkeep
git add -f .output/server/.gitkeep
```

That's it! Now Azure Static Web Apps will automatically deploy your Nitro-powered Nuxt application on push.
