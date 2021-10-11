# Azure Functions

> How to deploy Nuxt to Azure Functions with Nuxt Nitro.

 - Support for serverless SSR build
 - No configuration required
 - Static assets served from Azure Function

## Setup

```js [nuxt.config.js]
export default {
  nitro: {
    preset: 'azure_functions'
  }
}
```

## Local preview

Install [Azure Functions Core Tools](https://docs.microsoft.com/en-us/azure/azure-functions/functions-run-local) if you want to test locally.

You can invoke a development environment from the serverless directory.

```bash
NITRO_PRESET=azure_functions yarn build
cd .output
func start
```

You can now visit http://localhost:7071/ in your browser and browse your site running locally on Azure Functions.

## Deploy from your local machine

To deploy, just run the following command:
```bash
# To publish the bundled zip file
az functionapp deployment source config-zip -g <resource-group> -n <app-name> --src dist/deploy.zip
# Alternatively you can publish from source
cd dist && func azure functionapp publish --javascript <app-name>
```

## Deploy from CI/CD via GitHub Actions

First, obtain your Azure Functions Publish Profile and add it as a secret to your GitHub repository settings following [these instructions](https://github.com/Azure/functions-action#using-publish-profile-as-deployment-credential-recommended).

Then create the following file as a workflow:

```yml{}[.github/workflows/azure.yml]
name: azure

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  deploy:
    runs-on: ${{ matrix.os }}

    strategy:
      matrix:
        os: [ ubuntu-latest ]
        node: [ 12 ]

    steps:
      - uses: actions/setup-node@v2
        with:
          node-version: ${{ matrix.node }}

      - name: Checkout
        uses: actions/checkout@master

      - name: Get yarn cache directory path
        id: yarn-cache-dir-path
        run: echo "::set-output name=dir::$(yarn cache dir)"

      - uses: actions/cache@v2
        id: yarn-cache
        with:
          path: ${{ steps.yarn-cache-dir-path.outputs.dir }}
          key: ${{ runner.os }}-yarn-${{ hashFiles('**/yarn.lock') }}
          restore-keys: |
            ${{ runner.os }}-yarn-azure

      - name: Install Dependencies
        if: steps.cache.outputs.cache-hit != 'true'
        run: yarn

      - name: Build
        run: npm run build
        env:
          NITRO_PRESET: azure

      - name: 'Deploy to Azure Functions'
        uses: Azure/functions-action@v1
        with:
          app-name: <your-app-name>
          package: .output/deploy.zip
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

## Optimizing Azure Functions

Consider [turning on immutable packages](https://docs.microsoft.com/en-us/azure/app-service/deploy-run-package) to support running your app from the zipfile. This can speed up cold starts.

## Demo

A live demo is available on https://nuxt-nitro.azurewebsites.net/
