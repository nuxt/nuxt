// Based on https://github.com/webpack/webpack/blob/v4.46.0/lib/node/NodeMainTemplatePlugin.js#L81-L191

import type { Compiler } from 'webpack'
import Template from 'webpack/lib/Template'

export class AsyncLoadingPlugin {
  apply (compiler: Compiler) {
    compiler.hooks.compilation.tap('AsyncLoading', (compilation) => {
      const mainTemplate = compilation.mainTemplate
      mainTemplate.hooks.requireEnsure.tap(
        'AsyncLoading',
        (_source, chunk, hash) => {
          const chunkFilename = mainTemplate.outputOptions.chunkFilename
          const chunkMaps = chunk.getChunkMaps()
          const insertMoreModules = [
            'var moreModules = chunk.modules, chunkIds = chunk.ids;',
            'for(var moduleId in moreModules) {',
            Template.indent(
              mainTemplate.renderAddModule(
                hash,
                chunk,
                'moduleId',
                'moreModules[moduleId]'
              )
            ),
            '}'
          ]
          return Template.asString([
            '// Async chunk loading for Nitro',
            '',
            'var installedChunkData = installedChunks[chunkId];',
            'if(installedChunkData !== 0) { // 0 means "already installed".',
            Template.indent([
              '// array of [resolve, reject, promise] means "currently loading"',
              'if(installedChunkData) {',
              Template.indent(['promises.push(installedChunkData[2]);']),
              '} else {',
              Template.indent([
                '// load the chunk and return promise to it',
                'var promise = new Promise(function(resolve, reject) {',
                Template.indent([
                  'installedChunkData = installedChunks[chunkId] = [resolve, reject];',
                  'import(' +
                  mainTemplate.getAssetPath(
                    JSON.stringify(`./${chunkFilename}`),
                    {
                      hash: `" + ${mainTemplate.renderCurrentHashCode(
                        hash
                      )} + "`,
                      hashWithLength: length =>
                        `" + ${mainTemplate.renderCurrentHashCode(
                          hash,
                          length
                        )} + "`,
                      chunk: {
                        id: '" + chunkId + "',
                        hash: `" + ${JSON.stringify(
                          chunkMaps.hash
                        )}[chunkId] + "`,
                        hashWithLength: (length) => {
                          const shortChunkHashMap = {}
                          for (const chunkId of Object.keys(chunkMaps.hash)) {
                            if (typeof chunkMaps.hash[chunkId] === 'string') {
                              shortChunkHashMap[chunkId] = chunkMaps.hash[
                                chunkId
                              ].substr(0, length)
                            }
                          }
                          return `" + ${JSON.stringify(
                            shortChunkHashMap
                          )}[chunkId] + "`
                        },
                        contentHash: {
                          javascript: `" + ${JSON.stringify(
                            chunkMaps.contentHash.javascript
                          )}[chunkId] + "`
                        },
                        contentHashWithLength: {
                          javascript: (length) => {
                            const shortContentHashMap = {}
                            const contentHash =
                              chunkMaps.contentHash.javascript
                            for (const chunkId of Object.keys(contentHash)) {
                              if (typeof contentHash[chunkId] === 'string') {
                                shortContentHashMap[chunkId] = contentHash[
                                  chunkId
                                ].substr(0, length)
                              }
                            }
                            return `" + ${JSON.stringify(
                              shortContentHashMap
                            )}[chunkId] + "`
                          }
                        },
                        name: `" + (${JSON.stringify(
                          chunkMaps.name
                        )}[chunkId]||chunkId) + "`
                      },
                      contentHashType: 'javascript'
                    }
                  ) +
                  ').then(chunk => {',
                  Template.indent(
                    insertMoreModules
                      .concat([
                        'var callbacks = [];',
                        'for(var i = 0; i < chunkIds.length; i++) {',
                        Template.indent([
                          'if(installedChunks[chunkIds[i]])',
                          Template.indent([
                            'callbacks = callbacks.concat(installedChunks[chunkIds[i]][0]);'
                          ]),
                          'installedChunks[chunkIds[i]] = 0;'
                        ]),
                        '}',
                        'for(i = 0; i < callbacks.length; i++)',
                        Template.indent('callbacks[i]();')
                      ])
                  ),
                  '});'
                ]),
                '});',
                'promises.push(installedChunkData[2] = promise);'
              ]),
              '}'
            ]),
            '}'
          ])
        })
    })
  }
}
