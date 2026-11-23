import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const INTEGRATION_TEST_SUFFIX = '.integration-spec.ts'

async function collectIntegrationTests(directory, projectRoot, collected) {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectIntegrationTests(absolutePath, projectRoot, collected)
    } else if (entry.isFile() && entry.name.endsWith(INTEGRATION_TEST_SUFFIX)) {
      collected.push(path.relative(projectRoot, absolutePath).split(path.sep).join('/'))
    }
  }
}

export async function discoverIntegrationTests(projectRoot) {
  const collected = []
  await collectIntegrationTests(path.join(projectRoot, 'src'), projectRoot, collected)
  await collectIntegrationTests(path.join(projectRoot, 'test'), projectRoot, collected)
  return collected.sort((left, right) => left.localeCompare(right, 'en'))
}

export function buildJestArguments(projectRoot, testFile) {
  return [
    '--experimental-vm-modules',
    path.join(projectRoot, 'node_modules', 'jest', 'bin', 'jest.js'),
    '--config',
    path.join(projectRoot, 'test', 'jest.integration.config.cjs'),
    '--runInBand',
    '--runTestsByPath',
    path.resolve(projectRoot, testFile),
  ]
}

export async function runIntegrationTests({
  projectRoot = process.cwd(),
  spawn = spawnSync,
  report = console.log,
} = {}) {
  const testFiles = await discoverIntegrationTests(projectRoot)
  if (testFiles.length === 0) {
    throw new Error('No integration test files were discovered under src/ or test/')
  }

  report(`Discovered ${testFiles.length} integration test file(s)`)
  for (const testFile of testFiles) {
    report(`Running ${testFile}`)
    const result = spawn(process.execPath, buildJestArguments(projectRoot, testFile), {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
    })
    if (result.error) throw result.error
    if (result.status !== 0) return result.status ?? 1
  }
  return 0
}

async function main() {
  try {
    process.exitCode = await runIntegrationTests()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main()
}
