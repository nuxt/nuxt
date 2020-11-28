import replace from '@rollup/plugin-replace'
import archiver from 'archiver'
import consola from 'consola'
import createEtag from 'etag'
import { createWriteStream, readdirSync, readFileSync, statSync } from 'fs-extra'
import mime from 'mime'
import { join, relative, resolve } from 'upath'

import { prettyPath, writeFile } from '../utils'
import { SigmaPreset, SigmaContext } from '../context'

export const azure: SigmaPreset = {
  inlineChunks: false,
  entry: '{{ _internal.runtimeDir }}/entries/azure',
  hooks: {
    'sigma:rollup:before' (ctx: SigmaContext) {
      const manifest = JSON.stringify(getStaticManifest(ctx)).replace(/\\"/g, '\\\\"')
      ctx.rollupConfig.plugins.push(replace({
        values: {
          'process.env.STATIC_MANIFEST': `\`${manifest}\``
        }
      }))
    },
    async 'sigma:compiled' (ctx: SigmaContext) {
      await writeRoutes(ctx)
    }
  }
}

function getStaticManifest ({ output: { dir } }: SigmaContext) {
  const files = []
  const staticRoot = resolve(dir, 'public')

  const addFiles = (directory: string) => {
    const listing = readdirSync(directory)
    listing.forEach((filename) => {
      const fullPath = resolve(directory, filename)
      if (statSync(fullPath).isDirectory()) {
        return addFiles(fullPath)
      }
      files.push('/' + relative(staticRoot, fullPath))
    })
  }

  addFiles(staticRoot)
  const metadata = files.reduce((metadata, filename) => {
    let mimeType = mime.getType(filename) || 'text/plain'
    if (mimeType.startsWith('text')) {
      mimeType += '; charset=utf-8'
    }
    const etag = createEtag(readFileSync(join(staticRoot, filename)))
    metadata[filename] = [mimeType, etag]
    return metadata
  }, {} as Record<string, string>)

  return {
    files,
    metadata
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

async function writeRoutes ({ output: { dir, serverDir } }: SigmaContext) {
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
