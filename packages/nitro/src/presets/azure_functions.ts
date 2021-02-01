import archiver from 'archiver'
import consola from 'consola'
import { createWriteStream } from 'fs-extra'
import { join, resolve } from 'upath'
import { prettyPath, writeFile } from '../utils'
import { NitroPreset, NitroContext } from '../context'

// eslint-disable-next-line
export const azure_functions: NitroPreset = {
  inlineChunks: false,
  serveStatic: true,
  entry: '{{ _internal.runtimeDir }}/entries/azure_functions',
  hooks: {
    async 'nitro:compiled' (ctx: NitroContext) {
      await writeRoutes(ctx)
    }
  }
}

function zipDirectory (dir: string, outfile: string): Promise<undefined> {
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = createWriteStream(outfile)

  return new Promise((resolve, reject) => {
    archive
      .directory(dir, false)
      .on('error', (err: Error) => reject(err))
      .pipe(stream)

    stream.on('close', () => resolve(undefined))
    archive.finalize()
  })
}

async function writeRoutes ({ output: { dir, serverDir } }: NitroContext) {
  const host = {
    version: '2.0',
    extensions: { http: { routePrefix: '' } }
  }

  const functionDefinition = {
    entryPoint: 'handle',
    bindings: [
      {
        authLevel: 'anonymous',
        type: 'httpTrigger',
        direction: 'in',
        name: 'req',
        route: '{*url}',
        methods: [
          'delete',
          'get',
          'head',
          'options',
          'patch',
          'post',
          'put'
        ]
      },
      {
        type: 'http',
        direction: 'out',
        name: 'res'
      }
    ]
  }

  await writeFile(resolve(serverDir, 'function.json'), JSON.stringify(functionDefinition))
  await writeFile(resolve(dir, 'host.json'), JSON.stringify(host))

  await zipDirectory(dir, join(dir, 'deploy.zip'))
  const zipPath = prettyPath(resolve(dir, 'deploy.zip'))

  consola.success(`Ready to run \`az functionapp deployment source config-zip -g <resource-group> -n <app-name> --src ${zipPath}\``)
}
