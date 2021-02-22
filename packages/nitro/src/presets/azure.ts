import consola from 'consola'
import fse from 'fs-extra'
import globby from 'globby'
import { join, resolve } from 'upath'
import { writeFile } from '../utils'
import { NitroPreset, NitroContext } from '../context'

export const azure: NitroPreset = {
  entry: '{{ _internal.runtimeDir }}/entries/azure',
  output: {
    serverDir: '{{ output.dir }}/server/functions'
  },
  hooks: {
    async 'nitro:compiled' (ctx: NitroContext) {
      await writeRoutes(ctx)
    }
  }
}

async function writeRoutes ({ output: { serverDir, publicDir } }: NitroContext) {
  const host = {
    version: '2.0'
  }

  const routes = [
    {
      route: '/*',
      serve: '/api/server'
    }
  ]

  const indexPath = resolve(publicDir, 'index.html')
  const indexFileExists = fse.existsSync(indexPath)
  if (!indexFileExists) {
    routes.unshift(
      {
        route: '/',
        serve: '/api/server'
      },
      {
        route: '/index.html',
        serve: '/api/server'
      }
    )
  }

  const folderFiles = await globby([
    join(publicDir, 'index.html'),
    join(publicDir, '**/index.html')
  ])
  const prefix = publicDir.length
  const suffix = '/index.html'.length
  folderFiles.forEach(file =>
    routes.unshift({
      route: file.slice(prefix, -suffix) || '/',
      serve: file.slice(prefix)
    })
  )

  const otherFiles = await globby([join(publicDir, '**/*.html'), join(publicDir, '*.html')])
  otherFiles.forEach((file) => {
    if (file.endsWith('index.html')) {
      return
    }
    const route = file.slice(prefix, -5)
    const existingRouteIndex = routes.findIndex(_route => _route.route === route)
    if (existingRouteIndex > -1) {
      routes.splice(existingRouteIndex, 1)
    }
    routes.unshift(
      {
        route,
        serve: file.slice(prefix)
      }
    )
  })

  const functionDefinition = {
    entryPoint: 'handle',
    bindings: [
      {
        authLevel: 'anonymous',
        type: 'httpTrigger',
        direction: 'in',
        name: 'req',
        route: '{*url}',
        methods: ['delete', 'get', 'head', 'options', 'patch', 'post', 'put']
      },
      {
        type: 'http',
        direction: 'out',
        name: 'res'
      }
    ]
  }

  await writeFile(resolve(serverDir, 'function.json'), JSON.stringify(functionDefinition))
  await writeFile(resolve(serverDir, '../host.json'), JSON.stringify(host))
  await writeFile(resolve(publicDir, 'routes.json'), JSON.stringify({ routes }))
  if (!indexFileExists) {
    await writeFile(indexPath, '')
  }

  consola.success('Ready to deploy.')
}
