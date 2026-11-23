import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parseNameStatus, validateChanges } from './check.mjs'

test('accepts a domain file and an add-only migration with the change ID', () => {
  const changes = parseNameStatus('M\tbackend/src/modules/patients/patient.ts\nA\tbackend/src/database/migrations/2026112300100-C02-Patients.ts')
  assert.deepEqual(validateChanges('change/c-02-patients-and-catalogs', changes), [])
})

test('rejects an unknown branch', () => {
  assert.match(validateChanges('feature/patients', [])[0], /Unknown/)
})

test('rejects another domain and protected global state', () => {
  const violations = validateChanges('change/c-03-availability-and-schedule-settings', [
    { status: 'M', path: 'backend/src/modules/patients/patient.ts' },
    { status: 'M', path: 'openspec/specs/application-runtime/spec.md' },
  ])
  assert.equal(violations.length, 2)
})

test('rejects modified or incorrectly named migrations', () => {
  const violations = validateChanges('change/c-05-appointment-creation-engine', [
    { status: 'M', path: 'backend/src/database/migrations/2026112300100-C05-Turnos.ts' },
    { status: 'A', path: 'backend/src/database/migrations/2026112300200-Turnos.ts' },
  ])
  assert.equal(violations.length, 2)
  assert.match(violations.join('\n'), /add-only/)
  assert.match(violations.join('\n'), /must include C05/)
})

test('handles renamed paths using their destination', () => {
  const changes = parseNameStatus('R100\told.ts\tfrontend/src/features/agenda/new.ts')
  assert.deepEqual(validateChanges('change/c-07-agenda-experience', changes), [])
})

test('direct invocation executes the guard and diagnoses an unknown branch', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'agenda-scope-guard-'))
  const diffFile = path.join(temporaryDirectory, 'diff.txt')
  const checkFile = fileURLToPath(new URL('./check.mjs', import.meta.url))
  try {
    await writeFile(diffFile, 'M\tREADME.md\n', 'utf8')
    const result = spawnSync(
      process.execPath,
      [checkFile, '--branch', 'change/c-99-no-registrado', '--diff-file', diffFile],
      { encoding: 'utf8' },
    )

    assert.equal(result.status, 1)
    assert.match(result.stderr, /Unknown or unauthorized change branch/)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})
