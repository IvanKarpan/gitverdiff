/***********************************
 * File: src/index.js
 ***********************************/

'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {
  findGitRoot,
  getGitModifiedFiles,
  getPackageVersion,
  readPatternsFromFile,
  readPatternsFromPackageJson,
  sanitizeForFilesystem
} = require('./utils')
const { minimatch } = require('minimatch')

/**
 * Generates a version hash based on the current Git state and file diffs.
 * It checks for configuration in the provided package root first, and if not found, falls back to the Git root.
 *
 * @param {object} options                   Configuration options.
 * @param {string[]} [options.ignore]        Glob patterns to ignore.
 * @param {string[]} [options.include]       Glob patterns to include.
 * @param {string|string[]} [options.format] Format tokens for building the version string.
 * @param {string} [options.packageRoot]     The starting directory (defaults to process.cwd()).
 * @param {string} [options.separator]       The separator for tokens (defaults to '-' or package.json setting).
 * @returns {string}                         The generated version hash.
 */
function generateVersionHash (options = {}) {
  // Use provided packageRoot or current working directory.
  const packageRoot = options.packageRoot || process.cwd()

  // Step 1: Determine the Git root by scanning upward from packageRoot.
  const gitRoot = findGitRoot(packageRoot)

  // Step 2: Determine include patterns.
  let includePatterns = options.include || []
  if (!includePatterns.length) {
    includePatterns = readPatternsFromPackageJson('include', packageRoot) || []
  }
  if (!includePatterns.length) {
    includePatterns = readPatternsFromFile('.gitverdiff', packageRoot) || []
  }
  // Fallback to Git root if packageRoot config is missing.
  if (!includePatterns.length && packageRoot !== gitRoot) {
    includePatterns = readPatternsFromPackageJson('include', gitRoot) || []
  }
  if (!includePatterns.length && packageRoot !== gitRoot) {
    includePatterns = readPatternsFromFile('.gitverdiff', gitRoot) || []
  }
  if (!includePatterns.length) {
    includePatterns = ['**/*']
  }

  // Step 3: Determine ignore patterns.
  let ignorePatterns = options.ignore || []
  if (!ignorePatterns.length) {
    ignorePatterns = readPatternsFromPackageJson('ignore', packageRoot) || []
  }
  if (!ignorePatterns.length) {
    ignorePatterns = readPatternsFromFile('.gitverdiffignore', packageRoot) || []
  }
  if (!ignorePatterns.length && packageRoot !== gitRoot) {
    ignorePatterns = readPatternsFromPackageJson('ignore', gitRoot) || []
  }
  if (!ignorePatterns.length && packageRoot !== gitRoot) {
    ignorePatterns = readPatternsFromFile('.gitverdiffignore', gitRoot) || []
  }
  // If still empty, leave it as an empty array.

  // Step 4: Retrieve modified files from Git.
  const gitModifiedFiles = getGitModifiedFiles(gitRoot)

  // Step 5: Filter files by converting each file path (resolved from gitRoot) to a path relative to packageRoot,
  // then applying the include/ignore patterns on that relative path.
  const files = gitModifiedFiles.filter(filePath => {
    const absolutePath = path.resolve(gitRoot, filePath)
    const relativePath = path.relative(packageRoot, absolutePath)
    const isIncluded = includePatterns.some(pattern => minimatch(relativePath, pattern))
    const isIgnored = ignorePatterns.some(pattern => minimatch(relativePath, pattern))
    return isIncluded && !isIgnored
  }).sort()

  // Step 6: Compute a combined hash of file contents.
  const hash = crypto.createHash('sha256')
  // For each file, try reading from packageRoot first, then fallback to gitRoot.
  for (const filePath of files) {
    let absolutePath = path.resolve(packageRoot, filePath)
    if (!fs.existsSync(absolutePath)) {
      absolutePath = path.resolve(gitRoot, filePath)
    }
    const data = fs.readFileSync(absolutePath)
    hash.update(data)
  }
  const sourceHash = hash.digest('hex')

  // Step 7: Determine Git commit/branch info.
  const gitHead = fs.readFileSync(path.join(gitRoot, '.git', 'HEAD'), 'utf8').trim()
  let commitHash = ''
  let branchName = ''
  if (gitHead.startsWith('ref:')) {
    const refPath = gitHead.slice(5).trim() // e.g., "refs/heads/feat/test"
    const prefix = 'refs/heads/'
    if (refPath.startsWith(prefix)) {
      branchName = refPath.slice(prefix.length) // yields "feat/test"
    } else {
      branchName = refPath
    }
    commitHash = fs.readFileSync(path.join(gitRoot, '.git', refPath), 'utf8').trim()
  } else {
  // Detached HEAD or direct commit.
    commitHash = gitHead
  }
  const shortCommit = commitHash.substring(0, 7)

  // Step 8: Check if there are modifications.
  const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  const modificationsExist = sourceHash !== emptyHash

  // Step 9: Determine format tokens.
  let format = options.format
  if (!format || (Array.isArray(format) && format.length === 0)) {
    format = readPatternsFromPackageJson('format', packageRoot) || []
  }
  if (!format || (Array.isArray(format) && format.length === 0)) {
    // Fallback to Git root if necessary.
    if (packageRoot !== gitRoot) {
      format = readPatternsFromPackageJson('format', gitRoot) || []
    }
  }
  if (!format || (Array.isArray(format) && format.length === 0)) {
    format = ['package-version', 'branch', 'short-commit-sha', 'diff-hash']
  }
  if (typeof format === 'string') {
    format = format.split(',').map(s => s.trim())
  }

  // Step 10: Build tokens based on the specified format.
  // For package version, try packageRoot first, then fallback to gitRoot.
  let packageVersion = getPackageVersion(packageRoot)
  if (!packageVersion && packageRoot !== gitRoot) {
    packageVersion = getPackageVersion(gitRoot)
  }
  const tokens = []
  format.forEach(token => {
    switch (token) {
      case 'package-version':
        if (packageVersion) tokens.push(`v${packageVersion}`)
        break
      case 'branch':
        if (branchName) tokens.push(branchName)
        break
      case 'short-commit-sha':
        tokens.push(shortCommit)
        break
      case 'commit-sha':
        tokens.push(commitHash)
        break
      case 'diff-hash':
        if (modificationsExist) tokens.push(sourceHash)
        break
      default:
        throw new Error(`Unknown token: ${token}`)
    }
  })
  const sanisanitizedTokens = tokens.map(sanitizeForFilesystem)

  // Step 11: Determine the separator.
  let separator = options.separator
  if (!separator) {
    // Try packageRoot first.
    const pkgPath = path.join(packageRoot, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (pkgJson.gitverdiff && pkgJson.gitverdiff.separator) {
        separator = pkgJson.gitverdiff.separator
      }
    }
  }
  if (!separator && packageRoot !== gitRoot) {
    const pkgPath = path.join(gitRoot, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      if (pkgJson.gitverdiff && pkgJson.gitverdiff.separator) {
        separator = pkgJson.gitverdiff.separator
      }
    }
  }
  if (!separator) separator = '-'

  // Step 12: Join tokens using the chosen separator.
  return sanisanitizedTokens.join(separator)
}

module.exports = { generateVersionHash }
