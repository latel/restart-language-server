# 发布指南 / Release Guide

## 自动发布流程 / Automatic Release Process

本项目使用 GitHub Actions 自动化发布流程。

### 如何创建新版本 / How to Create a New Release

1. **更新版本号 / Update Version Number**
   
   在 `package.json` 中更新 `version` 字段：
   ```json
   {
     "version": "0.0.2"
   }
   ```

2. **提交更改 / Commit Changes**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 0.0.2"
   git push
   ```

3. **创建并推送标签 / Create and Push Tag**
   ```bash
   git tag v0.0.2
   git push origin v0.0.2
   ```

4. **自动发布 / Automatic Release**
   
   推送标签后，GitHub Actions 会自动：
   - 运行 lint 和测试
   - 打包扩展为 .vsix 文件
   - 创建 GitHub Release
   - 上传 .vsix 文件到 Release

### 发布到 VS Code Marketplace（可选）

如果要发布到 VS Code Marketplace：

1. **获取 Personal Access Token**
   - 访问 https://dev.azure.com/
   - 创建 Personal Access Token，权限选择 "Marketplace (Manage)"

2. **在 GitHub 中配置 Secret**
   - 进入仓库 Settings → Secrets and variables → Actions
   - 添加新的 secret: `VSCE_PAT`，值为你的 Personal Access Token

3. **启用 Marketplace 发布**
   
   编辑 `.github/workflows/release.yml`，取消注释最后两行：
   ```yaml
   - name: Publish to VS Code Marketplace
     run: vsce publish -p ${{ secrets.VSCE_PAT }}
   ```

## 工作流说明 / Workflow Description

### CI 工作流 (ci.yml)
- **触发条件**: Pull Request 和推送到 main/master 分支
- **执行内容**: Lint, 编译, 测试
- **运行环境**: Node.js 18.x 和 20.x

### Release 工作流 (release.yml)
- **触发条件**: 推送 v* 格式的 tag（如 v0.0.1, v1.0.0）
- **执行内容**: 
  - Lint 和测试
  - 打包扩展
  - 创建 GitHub Release
  - 可选：发布到 VS Code Marketplace

## 版本号规范 / Version Convention

遵循语义化版本规范 (Semantic Versioning):
- **Major (主版本)**: 不兼容的 API 更改
- **Minor (次版本)**: 向后兼容的功能新增
- **Patch (修订版本)**: 向后兼容的问题修正

示例 / Examples:
- `v0.0.1` → `v0.0.2` (修复 bug)
- `v0.0.2` → `v0.1.0` (新功能)
- `v0.1.0` → `v1.0.0` (重大更改)
