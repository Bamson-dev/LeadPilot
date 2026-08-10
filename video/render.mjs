import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const compositions = [
  { id: 'LeadThurDemo', filename: 'LeadThur-Demo-90s.mp4' },
  { id: 'MetaAd15', filename: 'LeadThur-Meta-15s.mp4' },
  { id: 'MetaAd30', filename: 'LeadThur-Meta-30s.mp4' },
]

const start = async () => {
  console.log('Bundling...')

  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, './src/index.ts'),
    webpackOverride: (config) => config,
  })

  for (const comp of compositions) {
    console.log(`\nRendering ${comp.id}...`)

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: comp.id,
    })

    const outputPath = path.join(os.homedir(), 'Downloads', comp.filename)

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: {},
      onProgress: ({ progress }) => {
        process.stdout.write(`\r${comp.id}: ${Math.round(progress * 100)}%`)
      },
    })

    console.log(`\nSaved: ${outputPath}`)
  }

  console.log('\nAll videos rendered.')
  console.log('Check your Downloads folder for:')
  console.log('  LeadThur-Demo-90s.mp4')
  console.log('  LeadThur-Meta-15s.mp4')
  console.log('  LeadThur-Meta-30s.mp4')
}

start().catch(console.error)
