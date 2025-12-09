# Restart Language Server

English | [中文文档](README.zh-CN.md)

Automatically restart language servers (like TypeScript/Vue/ESLint) when specific files or directories change.

## Features

- **Auto Restart**: Watches for file changes in your workspace and automatically triggers restart commands.
- **Configurable Watch Patterns**: Define exactly which files or folders should trigger a restart using glob patterns.
- **Custom Commands**: Configure which VS Code commands to execute (e.g., `typescript.restartTsServer`, `eslint.restart`).
- **Non-intrusive Notifications**: Shows a subtle progress bar notification when restarting, keeping your workflow uninterrupted. Detailed logs are available in the Output channel.

## Configuration

This extension contributes the following settings:

| Setting | Description | Default |
| :--- | :--- | :--- |
| `restart-language-server.enable` | Enable/disable this extension. | `true` |
| `restart-language-server.debug` | Enable verbose debug logging (file events and watcher details). | `false` |
| `restart-language-server.includes` | An array of glob patterns to watch. <br> **Example:** `["**/auto-imports.d.ts", "**/components.d.ts"]` | `["package.json", "package-lock.json", "pnpm-lock.yaml"]` |
| `restart-language-server.lsRestartCommands` | An array of VS Code commands to execute when a change is detected. <br> **Example:** `["typescript.restartTsServer", "eslint.restart"]` | `["typescript.restartTsServer"]` |

## Usage Example

Add the following to your `.vscode/settings.json` to restart TypeScript and ESLint servers whenever auto-generated declaration files change:

```json
{
  "restart-language-server.includes": [
    "**/auto-imports.d.ts",
    "**/components.d.ts"
  ],
  "restart-language-server.lsRestartCommands": [
    "typescript.restartTsServer",
    "eslint.restart"
  ]
}
```

## License

MIT
