import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const desktopPath = path.join(os.homedir(), 'Desktop')
const repoRoot = path.resolve(process.cwd(), '..')
const videoFileName = 'LeadThur-Demo.mp4'

console.log('Searching for rendered video file...')
console.log('Looking in:', repoRoot)

// Search common output locations
const searchPaths = [
  path.join(repoRoot, videoFileName),
  path.join(repoRoot, 'video', videoFileName),
  path.join(repoRoot, 'video', 'out', videoFileName),
  path.join(repoRoot, 'video', 'output', videoFileName),
  path.join(repoRoot, 'out', videoFileName),
  path.join(process.cwd(), videoFileName),
  path.join(process.cwd(), 'out', videoFileName),
]

let foundPath = null

for (const searchPath of searchPaths) {
  if (fs.existsSync(searchPath)) {
    foundPath = searchPath
    console.log('Found video at:', foundPath)
    break
  }
}

// If not found in known paths, do a deeper search
if (!foundPath) {
  console.log('Not found in common locations. Running deep search...')
  try {
    const result = execSync(
      `find ${repoRoot} -name "*.mp4" -not -path "*/node_modules/*" 2>/dev/null`,
      { encoding: 'utf8' }
    ).trim()

    if (result) {
      const files = result.split('\n').filter(Boolean)
      console.log('Found MP4 files:')
      files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
      foundPath = files[0]
      console.log('Using:', foundPath)
    }
  } catch {
    console.log('Deep search failed. Trying alternate method...')
  }
}

if (!foundPath) {
  console.log('')
  console.log('No MP4 file found anywhere in the project.')
  console.log('This means the video has not been rendered yet.')
  console.log('')
  console.log('Run this command first to render the video:')
  console.log('  cd video && node render.mjs')
  console.log('')
  console.log('Then run this script again after rendering completes.')
  process.exit(1)
}

// Copy to Desktop
const destinationPath = path.join(desktopPath, videoFileName)

console.log('')
console.log('Copying to Desktop...')

fs.copyFileSync(foundPath, destinationPath)

const stats = fs.statSync(destinationPath)
const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(1)

console.log('')
console.log('Done.')
console.log(`File saved to: ${destinationPath}`)
console.log(`File size: ${fileSizeMB} MB`)
console.log('')
console.log('Open your Desktop. The file LeadThur-Demo.mp4 is there.')
console.log('Double click it to play in QuickTime.')
