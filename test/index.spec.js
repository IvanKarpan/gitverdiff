/* eslint-env jest */

'use strict'

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { generateVersionHash } = require('../src/index.js')

// Mock execSync so that we can simulate Git output without requiring an actual repository.
jest.mock('child_process', () => ({
  execSync: jest.fn()
}))

describe('generateVersionHash', () => {
  let tempDir

  beforeEach(() => {
    // Create a temporary directory to simulate a monorepo root.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitverdiff-'))

    // Create a minimal .git structure in the repo root.
    const gitDir = path.join(tempDir, '.git')
    fs.mkdirSync(gitDir)

    // Default: simulate HEAD pointing to a branch ("main")
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/main')

    // Create the refs folder and main branch ref with a dummy commit hash.
    const refsHeadsDir = path.join(gitDir, 'refs', 'heads')
    fs.mkdirSync(refsHeadsDir, { recursive: true })
    const dummyCommit = 'abcdef1234567890abcdef1234567890abcdef12'
    fs.writeFileSync(path.join(refsHeadsDir, 'main'), dummyCommit)

    // Create a package.json file in the monorepo (Git root) with full config.
    const pkg = {
      version: '1.2.3',
      gitverdiff: {
        separator: '|',
        format: 'package-version,branch,short-commit-sha',
        include: ['*.js'],
        ignore: []
      }
    }
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg, null, 2))
  })

  afterEach(() => {
    // Remove the temporary directory and its contents.
    fs.rmSync(tempDir, { recursive: true, force: true })
    jest.resetAllMocks()
  })

  test('generates version hash with default tokens and no modifications', () => {
    // Simulate no modified files: execSync returns empty string.
    childProcess.execSync.mockReturnValue('')
    const hash = generateVersionHash({ packageRoot: tempDir })
    // Expected tokens:
    //   package-version: "1.2.3"
    //   branch: "main"
    //   short-commit-sha: first 7 characters of dummyCommit = 'abcdef1'
    expect(hash).toBe('v1.2.3|main|abcdef1')
  })

  test('generates version hash including diff-hash when modifications exist', () => {
    // Simulate modified files: execSync returns file paths.
    childProcess.execSync.mockReturnValue('file1.js\nfile2.js')
    // Create dummy files in tempDir to simulate modifications.
    fs.writeFileSync(path.join(tempDir, 'file1.js'), 'console.log("Hello");')
    fs.writeFileSync(path.join(tempDir, 'file2.js'), 'console.log("World");')

    // Override format and separator via options.
    const hash = generateVersionHash({
      packageRoot: tempDir,
      format: 'package-version,branch,short-commit-sha,diff-hash',
      separator: '|'
    })

    // The diff-hash token should be a 64-character hex string.
    const parts = hash.split('|')
    expect(parts.length).toBe(4)
    expect(parts[0]).toBe('v1.2.3')
    expect(parts[1]).toBe('main')
    expect(parts[2]).toBe('abcdef1')
    expect(parts[3]).toMatch(/^[a-f0-9]{64}$/)
  })

  test('allows overriding format and separator via options', () => {
    // Simulate no modified files.
    childProcess.execSync.mockReturnValue('')
    const hash = generateVersionHash({
      packageRoot: tempDir,
      format: 'branch,short-commit-sha',
      separator: '-'
    })
    expect(hash).toBe('main-abcdef1')
  })

  test('applies custom include and ignore patterns from options', () => {
    // Simulate modified files: execSync returns two files.
    childProcess.execSync.mockReturnValue('include.js\nexclude.js')
    // Create dummy files in tempDir.
    const includeFile = path.join(tempDir, 'include.js')
    const excludeFile = path.join(tempDir, 'exclude.js')
    fs.writeFileSync(includeFile, 'included content')
    fs.writeFileSync(excludeFile, 'excluded content')

    // Use custom options to include only 'include.js' and ignore 'exclude.js'.
    const hash = generateVersionHash({
      packageRoot: tempDir,
      include: ['include.js'],
      ignore: ['exclude.js'],
      format: 'diff-hash',
      separator: '|'
    })

    // Compute expected diff-hash from 'included content'.
    const expectedDiffHash = crypto.createHash('sha256')
      .update('included content')
      .digest('hex')
    expect(hash).toBe(expectedDiffHash)
  })

  // New tests covering fallback mechanics.

  test('uses packageRoot configuration when available instead of falling back to Git root', () => {
    // Create a subdirectory to simulate a package with its own configuration.
    const subDir = path.join(tempDir, 'packages', 'my-package')
    fs.mkdirSync(subDir, { recursive: true })
    // Write a package.json in the subdirectory with different config.
    const subPkg = {
      version: '9.9.9',
      gitverdiff: {
        separator: '@',
        format: 'package-version,branch,short-commit-sha',
        include: ['custom.js'],
        ignore: []
      }
    }
    fs.writeFileSync(path.join(subDir, 'package.json'), JSON.stringify(subPkg, null, 2))
    // Create a dummy file that matches the subDir config.
    fs.writeFileSync(path.join(subDir, 'custom.js'), 'custom content')
    // Simulate modified file from git.
    childProcess.execSync.mockReturnValue('custom.js\nother.js')
    // Also create the 'other.js' file at the monorepo level.
    fs.writeFileSync(path.join(tempDir, 'other.js'), 'other content')
    // Use subDir as packageRoot.
    const hash = generateVersionHash({
      packageRoot: subDir,
      format: 'package-version,branch,short-commit-sha,diff-hash',
      separator: '@'
    })
    // Since include patterns in subDir config only include 'custom.js', diff-hash should be computed from 'custom content'.
    const diffHash = crypto.createHash('sha256')
      .update('custom content')
      .digest('hex')
    // Expect tokens: package-version from subDir ("9.9.9"), branch ("main" inherited from Git root),
    // short-commit-sha from dummy commit = 'abcdef1', and diff-hash.
    expect(hash).toBe(`v9.9.9@main@abcdef1@${diffHash}`)
  })

  test('falls back to Git root configuration when packageRoot has no config', () => {
    // Create a subdirectory that does NOT contain its own package.json.
    const subDir = path.join(tempDir, 'packages', 'no-config')
    fs.mkdirSync(subDir, { recursive: true })
    // In this case, configuration should be read from the Git root (tempDir).
    childProcess.execSync.mockReturnValue('')
    const hash = generateVersionHash({
      packageRoot: subDir,
      format: 'package-version,branch,short-commit-sha'
      // Not providing separator, so should fall back to package.json in Git root, which is '|'
    })
    expect(hash).toBe('v1.2.3|main|abcdef1')
  })

  test('separator override: uses default "-" when not provided in package.json or options', () => {
    // Remove separator from Git root package.json.
    const pkg = {
      version: '1.2.3',
      gitverdiff: {
        format: 'branch,short-commit-sha'
      }
    }
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg, null, 2))
    childProcess.execSync.mockReturnValue('')
    const hash = generateVersionHash({
      packageRoot: tempDir,
      format: 'branch,short-commit-sha'
    })
    expect(hash).toBe('main-abcdef1')
  })

  test('throws error for unknown format token', () => {
    childProcess.execSync.mockReturnValue('')
    expect(() => {
      generateVersionHash({
        packageRoot: tempDir,
        format: 'package-version,unknown'
      })
    }).toThrow(/Unknown token: unknown/)
  })

  test('handles detached HEAD scenario', () => {
    // Simulate detached HEAD by writing a commit hash directly in .git/HEAD.
    const gitDir = path.join(tempDir, '.git')
    const detachedCommit = '1234567890abcdef1234567890abcdef12345678'
    fs.writeFileSync(path.join(gitDir, 'HEAD'), detachedCommit)
    // In detached HEAD, no branch is defined.
    // Ensure that when format includes branch, it is skipped.
    childProcess.execSync.mockReturnValue('') // No modified files.
    const hash = generateVersionHash({
      packageRoot: tempDir,
      format: 'package-version,branch,short-commit-sha',
      separator: '|'
    })
    // Expect that branch token is omitted because HEAD is detached.
    // So the tokens should be: package-version and short-commit-sha.
    // short-commit-sha is first 7 characters of detachedCommit.
    expect(hash).toBe(`v1.2.3|${detachedCommit.substring(0, 7)}`)
  })

  test('handles non-main branch scenario (simple branch name)', () => {
    const gitDir = path.join(tempDir, '.git')
    // Simulate HEAD pointing to a branch "refs/heads/test"
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/test')
    // Create the refs folder and test branch ref with a dummy commit hash.
    const refsHeadsDir = path.join(gitDir, 'refs', 'heads')
    // No additional subdirectory needed if branch is just "test"
    const testCommit = 'fedcba9876543210fedcba9876543210fedcba98'
    fs.writeFileSync(path.join(refsHeadsDir, 'test'), testCommit)
    childProcess.execSync.mockReturnValue('')
    // Use a format that includes branch and short-commit-sha.
    const hash = generateVersionHash({
      packageRoot: tempDir,
      format: 'branch,short-commit-sha',
      separator: '-'
    })
    // Expect branch token to be "test" and short commit to be first 7 characters of testCommit.
    expect(hash).toBe(`test-${testCommit.substring(0, 7)}`)
  })

  test('handles complex branch name scenario', () => {
    // Simulate a complex branch name "feat/test"
    const gitDir = path.join(tempDir, '.git')
    fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/feat/test')
    // Create necessary directories for the branch ref.
    const refsFeatDir = path.join(gitDir, 'refs', 'heads', 'feat')
    fs.mkdirSync(refsFeatDir, { recursive: true })
    const complexCommit = '11223344556677889900aabbccddeeff00112233'
    fs.writeFileSync(path.join(refsFeatDir, 'test'), complexCommit)
    childProcess.execSync.mockReturnValue('')
    const hash = generateVersionHash({
      packageRoot: tempDir,
      format: 'branch,short-commit-sha',
      separator: '-'
    })
    // Expect the branch token to be "feat/test" and short commit to be first 7 characters of complexCommit.
    expect(hash).toBe(`feat:test-${complexCommit.substring(0, 7)}`)
  })
})
