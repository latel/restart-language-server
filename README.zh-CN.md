# 重启语言服务器 (Restart Language Server)

[English](README.md) | 中文文档

当特定文件或目录发生变化时，自动重启语言服务器（如 TypeScript/Vue/ESLint）。

## 功能特性

- **自动重启**：监听工作区中的文件变化，并自动触发重启命令。
- **可配置的监听模式**：使用 glob 模式精确定义哪些文件或文件夹应触发重启。
- **自定义命令**：配置要执行的 VS Code 命令（例如 `typescript.restartTsServer`, `eslint.restart`）。
- **非侵入式通知**：重启时显示轻量级的进度条通知，不打断您的工作流程。详细日志可在“输出”面板中查看。

## 配置项

本扩展提供以下设置：

| 设置项 | 描述 | 默认值 |
| :--- | :--- | :--- |
| `restart-language-server.enable` | 启用/禁用此扩展。 | `true` |
| `restart-language-server.debug` | 开启详细调试日志（记录触发的文件事件、监听器信息）。 | `false` |
| `restart-language-server.includes` | 要监听的 glob 模式数组。<br> **示例：** `["**/auto-imports.d.ts", "**/components.d.ts"]` | `["package.json", "package-lock.json", "pnpm-lock.yaml"]` |
| `restart-language-server.lsRestartCommands` | 检测到变化时要执行的 VS Code 命令数组。<br> **示例：** `["typescript.restartTsServer", "eslint.restart"]` | `["typescript.restartTsServer"]` |

## 使用示例

将以下内容添加到您的 `.vscode/settings.json` 中，以便在自动生成的声明文件发生变化时重启 TypeScript 和 ESLint 服务器：

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

## 许可证

MIT
