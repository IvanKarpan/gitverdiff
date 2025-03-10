#!/usr/bin/env node

/***********************************
 * File: bin/gitverdiff.js
 ***********************************/

'use strict'

const { generateVersionHash } = require('../src/index.js')

// Provide help text for the available format tokens
const FORMAT_TOKENS_HELP = `
Available format tokens:
  - package-version: The version from package.json.
  - branch: The current Git branch name.
  - short-commit-sha: The first 7 characters of the commit hash.
  - commit-sha: The full commit hash.
  - diff-hash: The SHA256 hash of the diff (modified files).

Default format: package-version, branch, short-commit-sha, diff-hash.
`

// Provide overall help text
const HELP_TEXT = `
Usage: gitverdiff [include patterns...] [--ignore <pattern>] [--format <token,token,...>] [--separator <separator>] [--help]

Options:
  include patterns        Glob patterns to include files.
  --ignore <pattern>      Glob pattern to exclude files.
  --format <tokens>       Comma-separated list of format tokens to compose the version hash.
                          ${FORMAT_TOKENS_HELP.trim().split('\n').join('\n                          ')}
  --separator <sep>       Separator string used to join tokens (default: '-').
  --help                  Show this help message.
`

// If --help is passed, print help and exit
if (process.argv.includes('--help')) {
  console.log(HELP_TEXT)
  process.exit(0)
}

/**
 * Parse command-line arguments for include, ignore, format, and separator options.
 *
 * @param {string[]} args - The array of CLI arguments.
 * @returns {object}      An object containing parsed options for include, ignore, format, and separator.
 */
function parseArguments (args) {
  const includePatterns = []
  const ignorePatterns = []
  let format = null
  let separator = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ignore' && args[i + 1]) {
      ignorePatterns.push(args[i + 1])
      i++
    } else if (args[i] === '--format' && args[i + 1]) {
      format = args[i + 1]
      i++
    } else if (args[i] === '--separator' && args[i + 1]) {
      separator = args[i + 1]
      i++
    } else if (!args[i].startsWith('--')) {
      includePatterns.push(args[i])
    }
  }
  return { includePatterns, ignorePatterns, format, separator }
}

try {
  // Parse CLI arguments
  const args = process.argv.slice(2)
  const { includePatterns, ignorePatterns, format, separator } = parseArguments(args)

  // Generate the version hash
  const hash = generateVersionHash({
    include: includePatterns,
    ignore: ignorePatterns,
    format,
    separator
  })

  // Print the resulting hash
  console.log(hash)
} catch (error) {
  // If there's an unknown token, print the token help
  if (error.message.includes('Unknown token:')) {
    console.error('Error:', error.message)
    console.error(FORMAT_TOKENS_HELP)
  } else {
    console.error('Error generating version hash:', error.message)
  }
  process.exit(1)
}
