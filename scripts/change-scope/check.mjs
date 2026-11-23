import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDirectory = fileURLToPath(new URL('.', import.meta.url))
const scopeMap = JSON.parse(readFileSync(new URL('scope-map.json', import.meta.url), 'utf8'))

function valueAfter(args, option) {
  const index = args.indexOf(option)
  return index >= 0 ? args[index + 1] : undefined
}

export function parseNameStatus(input) {
  return input.split(/\r?\n/u).filter(Boolean).map((line) => {
    const columns = line.split('\t')
    const status = columns[0]
    const path = status.startsWith('R') || status.startsWith('C') ? columns[2] : columns[1]
    return { status: status[0], path }
  })
}

function matches(path, candidate) {
  return candidate.endsWith('/') ? path.startsWith(candidate) : path === candidate
}

export function validateChanges(branch, changes, map = scopeMap) {
  const policy = map.policies[branch]
  if (!policy) return [`Unknown or unauthorized change branch: ${branch}`]

  const violations = []
  for (const change of changes) {
    const isOwnOpenSpec = change.path.startsWith(`openspec/changes/c-${policy.id.slice(1)}-`)
    const isProtected = map.protected.some((candidate) => matches(change.path, candidate))
    if (isProtected && !isOwnOpenSpec) {
      violations.push(`${change.path}: protected project surface`)
      continue
    }
    if (!policy.allow.some((candidate) => matches(change.path, candidate))) {
      violations.push(`${change.path}: outside ownership for ${policy.id}`)
      continue
    }
    if (change.path.startsWith('backend/src/database/migrations/')) {
      if (change.status !== 'A') violations.push(`${change.path}: migrations are add-only`)
      if (!change.path.toUpperCase().includes(policy.id)) violations.push(`${change.path}: migration name must include ${policy.id}`)
    }
  }
  return violations
}

function main() {
  const args = process.argv.slice(2)
  const branch = valueAfter(args, '--branch') ?? process.env.CHANGE_BRANCH
  const diffFile = valueAfter(args, '--diff-file')
  const base = valueAfter(args, '--base')
  if (!branch) throw new Error('Provide --branch or CHANGE_BRANCH')
  const diff = diffFile
    ? readFileSync(diffFile, 'utf8')
    : execFileSync('git', ['diff', '--name-status', `${base ?? 'main'}...HEAD`], { encoding: 'utf8', cwd: process.cwd() })
  const violations = validateChanges(branch, parseNameStatus(diff))
  if (violations.length > 0) {
    console.error(`Scope check failed (${violations.length}):\n- ${violations.join('\n- ')}`)
    process.exitCode = 1
    return
  }
  console.log(`Scope check passed for ${branch}`)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main()
