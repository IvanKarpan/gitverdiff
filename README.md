# gitverdiff

`gitverdiff` is a CLI tool and Node.js library for generating version hashes based on your Git repository's state and file modifications. It helps with cache busting and versioning by producing unique identifiers (hashes) that can be embedded in filenames.

## Features

- **Version Hash Generation:**  
  Combines data from multiple sources:
  - **Package Version:** The version field from your `package.json`.
  - **Git Information:** Current branch name, full commit hash, or short commit hash.
  - **Diff Hash:** A SHA256 hash computed from the contents of modified files.

- **Flexible Configuration:**  
  Configure via command-line arguments, a `gitverdiff` field in your `package.json`, or local configuration files (`.gitverdiff` and `.gitverdiffignore`).

- **Monorepo Support:**  
  If you run the command from a subdirectory in a monorepo, `gitverdiff` will first check for configuration in that subdirectory’s package root. If none is found, it falls back to the Git root.

- **Customizable Output:**  
  Define the output format and token separator to fit your build or deployment process.

## Installation

Install globally using **npm**, **pnpm**, or **yarn**:

```bash
npm install -g gitverdiff
# or
pnpm add -g gitverdiff
# or
yarn global add gitverdiff
```

## Usage

### CLI

Run the command in your project directory:

```bash
gitverdiff [include patterns...] [--ignore <pattern>] [--format <token,token,...>] [--separator <separator>] [--help]
```

#### Options

- **include patterns:**  
  Glob patterns to include files.

- **--ignore <pattern>:**  
  Glob pattern to exclude files.

- **--format <tokens>:**  
  Comma-separated list of tokens for building the version hash.

  **Available tokens:**
  - `package-version`: The version from `package.json`
  - `branch`: The current Git branch name
  - `short-commit-sha`: The first 7 characters of the commit hash
  - `commit-sha`: The full commit hash
  - `diff-hash`: The SHA256 hash of the diff (modified files)

  *Default:* `package-version,branch,short-commit-sha,diff-hash`

- **--separator <separator>:**  
  Separator string used to join tokens (defaults to `-` or the value from `package.json`).

- **--help:**  
  Show this help message.

#### Examples

- **Default configuration** (relies on package.json and/or local config files):
  ```bash
  gitverdiff
  ```

- **Overriding format and separator**:
  ```bash
  gitverdiff --format branch,short-commit-sha --separator "."
  ```

### API

You can also use `gitverdiff` programmatically:

```js
const { generateVersionHash } = require('gitverdiff')

const versionHash = generateVersionHash({
  format: 'package-version,branch,short-commit-sha,diff-hash',
  packageRoot: __dirname, // Optional: starting directory (defaults to process.cwd())
  separator: '|'
})

console.log('Version hash:', versionHash)
```

## Configuration

`gitverdiff` supports configuration via multiple methods:

1. **Command-Line Arguments**  
   Pass options like `--format`, `--ignore`, and `--separator` directly.

2. **package.json**  
   Add a `gitverdiff` field in your `package.json`:
   ```json
   {
     "gitverdiff": {
       "format": "package-version,branch,short-commit-sha,diff-hash",
       "ignore": ["src/config.json", "src/build/*"],
       "include": ["src/**/*"],
       "separator": "|"
     }
   }
   ```

3. **Local Configuration Files**  
   - **.gitverdiff** : Contains include patterns (one per line).
   - **.gitverdiffignore** : Contains ignore patterns (one per line).

In a **monorepo**, if a package has its own configuration in the package root, that configuration is used first. Otherwise, `gitverdiff` falls back to the configuration in the Git root.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your ideas or improvements.

## Author

Ivan Karpan

## Contributors

ChatGPT
