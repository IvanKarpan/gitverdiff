/***********************************
 * File: src/utils.js
 ***********************************/

'use strict'

const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')

/**
 * Recursively searches parent directories for a .git folder.
 * Returns the absolute path of the repository root if found.
 * Throws an error if none is discovered.
 *
 * @param {string} startDir The initial directory to begin searching from.
 * @returns {string}        The absolute path to the directory containing .git.
 */
function findGitRoot (startDir) {
  let current = path.resolve(startDir)
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error(`No .git directory found up the chain from ${startDir}`)
    }
    current = parent
  }
}

/**
 * Retrieves modified files recognized by Git, including untracked and deleted files.
 * Assumes the current working directory is within a Git repository.
 *
 * @returns {string[]} An array of file paths that Git considers modified.
 */
function getGitModifiedFiles (cwd) {
  try {
    // First get the list of modified and untracked files
    const lsFilesOutput = childProcess.execSync(
      'git ls-files -m -o --exclude-standard',
      { cwd, encoding: 'utf8' }
    )
    const files = lsFilesOutput.split('\n').filter(Boolean)

    // Then get the status to identify deleted files
    const statusOutput = childProcess.execSync(
      'git status --porcelain',
      { cwd, encoding: 'utf8' }
    )
    const deletedFiles = statusOutput.split('\n')
      .filter(line => line.startsWith(' D '))
      .map(line => line.slice(3))

    // Combine both lists, ensuring no duplicates
    return [...new Set([...files, ...deletedFiles])]
  } catch (err) {
    console.error('Error retrieving modified files from Git:', err)
    return []
  }
}

/**
 * Retrieves the package version from package.json in the given packageRoot.
 *
 * @param {string} packageRoot The root directory containing package.json.
 * @returns {string}           The version field from package.json, or an empty string if not found.
 */
function getPackageVersion (packageRoot) {
  const packageJsonPath = path.resolve(packageRoot, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      return packageJson.version || ''
    } catch (error) {
      // If package.json is invalid, return empty string
      return ''
    }
  }
  return ''
}

/**
 * Reads patterns from a file in packageRoot (e.g., .gitverdiff).
 *
 * @param {string} filePath    The file path, relative to packageRoot.
 * @param {string} packageRoot The root directory of the project.
 * @returns {string[]}         An array of patterns read from the file, or an empty array if none found.
 */
function readPatternsFromFile (filePath, packageRoot) {
  const resolvedPath = path.resolve(packageRoot, filePath)
  return fs.existsSync(resolvedPath)
    ? fs.readFileSync(resolvedPath, 'utf8').split(/\r?\n/).filter(Boolean)
    : []
}

/**
 * Reads a configuration field (e.g., 'include', 'ignore', 'format') from package.json under gitverdiff.
 *
 * @param {string} field       The gitverdiff field name in package.json.
 * @param {string} packageRoot The root directory of the project.
 * @returns {Array}            The array of patterns or values found, or an empty array if not defined.
 */
function readPatternsFromPackageJson (field, packageRoot) {
  const packageJsonPath = path.resolve(packageRoot, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      return packageJson.gitverdiff && packageJson.gitverdiff[field]
        ? packageJson.gitverdiff[field]
        : []
    } catch (error) {
      // If package.json is invalid, return empty array
      return []
    }
  }
  return []
}

function sanitizeForFilesystem (token) {
  return token.replace(/[^a-zA-Z0-9-_.]/g, ':')
}

module.exports = {
  findGitRoot,
  getGitModifiedFiles,
  getPackageVersion,
  readPatternsFromFile,
  readPatternsFromPackageJson,
  sanitizeForFilesystem
}
