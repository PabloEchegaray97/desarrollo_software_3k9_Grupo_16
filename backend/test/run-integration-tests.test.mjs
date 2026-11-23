import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildJestArguments,
  discoverIntegrationTests,
  runIntegrationTests,
} from './run-integration-tests.mjs'

async function withTemporaryProject(callback) {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'agenda-integration-runner-'))
  try {
    await callback(projectRoot)
  } finally {
    await rm(projectRoot, { recursive: true, force: true })
  }
}

async function addFile(projectRoot, relativePath) {
  const absolutePath = path.join(projectRoot, relativePath)
  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, '// fictional test fixture\n', 'utf8')
}

void test('discovers integration suites under src and test in stable order', async () => {
  await withTemporaryProject(async (projectRoot) => {
    await addFile(projectRoot, 'test/z-last.integration-spec.ts')
    await addFile(projectRoot, 'src/modules/catalogs/a-first.integration-spec.ts')
    await addFile(projectRoot, 'src/modules/catalogs/ignored.spec.ts')

    assert.deepEqual(await discoverIntegrationTests(projectRoot), [
      'src/modules/catalogs/a-first.integration-spec.ts',
      'test/z-last.integration-spec.ts',
    ])
  })
})

void test('fails explicitly when no integration suites exist', async () => {
  await withTemporaryProject(async (projectRoot) => {
    await assert.rejects(
      () => runIntegrationTests({ projectRoot, report: () => undefined }),
      /No integration test files were discovered/,
    )
  })
})

void test('invokes one isolated Jest process per discovered suite', async () => {
  await withTemporaryProject(async (projectRoot) => {
    await addFile(projectRoot, 'test/database.integration-spec.ts')
    await addFile(projectRoot, 'src/modules/auth/auth.integration-spec.ts')
    const calls = []
    const status = await runIntegrationTests({
      projectRoot,
      report: () => undefined,
      spawn(command, args, options) {
        calls.push({ command, args, options })
        return { status: 0 }
      },
    })

    assert.equal(status, 0)
    assert.equal(calls.length, 2)
    assert.deepEqual(
      calls.map(({ args }) => path.basename(args.at(-1))),
      ['auth.integration-spec.ts', 'database.integration-spec.ts'],
    )
    for (const call of calls) {
      assert.equal(call.command, process.execPath)
      assert.equal(call.options.cwd, projectRoot)
      assert.equal(call.options.stdio, 'inherit')
      assert.ok(call.args.includes('--runTestsByPath'))
    }
  })
})

void test('propagates the first non-zero Jest status', async () => {
  await withTemporaryProject(async (projectRoot) => {
    await addFile(projectRoot, 'test/one.integration-spec.ts')
    await addFile(projectRoot, 'test/two.integration-spec.ts')
    let invocations = 0
    const status = await runIntegrationTests({
      projectRoot,
      report: () => undefined,
      spawn() {
        invocations += 1
        return { status: 7 }
      },
    })

    assert.equal(status, 7)
    assert.equal(invocations, 1)
  })
})

void test('builds Jest arguments with the integration config and one absolute test path', () => {
  const projectRoot = path.resolve('fictional-backend')
  const args = buildJestArguments(projectRoot, 'src/example.integration-spec.ts')

  assert.equal(args.filter((value) => value === '--runTestsByPath').length, 1)
  assert.equal(args.at(-1), path.resolve(projectRoot, 'src/example.integration-spec.ts'))
  assert.ok(args.includes(path.join(projectRoot, 'test', 'jest.integration.config.cjs')))
})
