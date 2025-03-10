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
 * Retrieves modified files recognized by Git, including untracked files.
 * Assumes the current working directory is within a Git repository.
 *
 * @returns {string[]} An array of file paths that Git considers modified.
 */
function getGitModifiedFiles () {
  try {
    const output = childProcess.execSync(
      'git ls-files -m -o --exclude-standard',
      { encoding: 'utf8' }
    )
    return output.split('\n').filter(Boolean)
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
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return packageJson.version || ''
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
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    return packageJson.gitverdiff && packageJson.gitverdiff[field]
      ? packageJson.gitverdiff[field]
      : []
  }
  return []
}

module.exports = {
  findGitRoot,
  getGitModifiedFiles,
  getPackageVersion,
  readPatternsFromFile,
  readPatternsFromPackageJson
}
