/* eslint-env jest */

'use strict'

const childProcess = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  findGitRoot,
  getGitModifiedFiles,
  getPackageVersion,
  readPatternsFromFile,
  readPatternsFromPackageJson
} = require('../src/utils')

describe('Utils functions', () => {
  let tempDir

  beforeEach(() => {
    // Create a temporary directory for tests.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitverdiff-utils-'))
  })

  afterEach(() => {
    // Clean up temporary directory.
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  describe('findGitRoot', () => {
    test('should return the directory containing .git', () => {
      const gitRoot = path.join(tempDir, 'repo')
      fs.mkdirSync(gitRoot)
      fs.mkdirSync(path.join(gitRoot, '.git'))
      const nestedDir = path.join(gitRoot, 'src', 'lib')
      fs.mkdirSync(nestedDir, { recursive: true })

      const foundRoot = findGitRoot(nestedDir)
      expect(foundRoot).toBe(gitRoot)
    })

    test('should throw error if no .git directory is found', () => {
      expect(() => findGitRoot(tempDir)).toThrow(/No \.git directory found/)
    })
  })

  describe('getGitModifiedFiles', () => {
    test('should split and filter output from execSync', () => {
      const mockOutput = 'file1.js\nfile2.js\n\n'
      const spy = jest
        .spyOn(childProcess, 'execSync')
        .mockReturnValue(mockOutput)
      const files = getGitModifiedFiles()
      expect(files).toEqual(['file1.js', 'file2.js'])
      spy.mockRestore()
    })

    test('should return empty array if execSync fails', () => {
      const spy = jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
        throw new Error('Test error')
      })
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const files = getGitModifiedFiles()
      expect(files).toEqual([])
      spy.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe('getPackageVersion', () => {
    test('should return version from package.json', () => {
      const pkg = { version: '4.5.6' }
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg))
      const version = getPackageVersion(tempDir)
      expect(version).toBe('4.5.6')
    })

    test('should return empty string if package.json does not exist', () => {
      const version = getPackageVersion(tempDir)
      expect(version).toBe('')
    })
  })

  describe('readPatternsFromFile', () => {
    test('should return array of non-empty lines from a file', () => {
      const content = 'pattern1\npattern2\n\npattern3'
      const filePath = path.join(tempDir, 'patterns.txt')
      fs.writeFileSync(filePath, content)
      const patterns = readPatternsFromFile('patterns.txt', tempDir)
      expect(patterns).toEqual(['pattern1', 'pattern2', 'pattern3'])
    })

    test('should return empty array if file does not exist', () => {
      const patterns = readPatternsFromFile('nonexistent.txt', tempDir)
      expect(patterns).toEqual([])
    })
  })

  describe('readPatternsFromPackageJson', () => {
    test('should return field value from gitverdiff in package.json', () => {
      const pkg = { gitverdiff: { include: ['a.js', 'b.js'] } }
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg))
      const patterns = readPatternsFromPackageJson('include', tempDir)
      expect(patterns).toEqual(['a.js', 'b.js'])
    })

    test('should return empty array if field is not present', () => {
      const pkg = { version: '1.0.0' }
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg))
      const patterns = readPatternsFromPackageJson('ignore', tempDir)
      expect(patterns).toEqual([])
    })

    test('should return empty array if package.json does not exist', () => {
      const patterns = readPatternsFromPackageJson('include', tempDir)
      expect(patterns).toEqual([])
    })
  })
})
