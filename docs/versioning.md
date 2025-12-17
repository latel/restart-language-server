# 版本与发布流程（Changesets + GitHub Actions）

本仓库通过 **Changesets** 管理版本号与变更日志，通过 **GitHub Actions release 工作流** 打包并发布 VS Code 扩展到 Marketplace。请严格遵循以下流程。

## 日常开发

1. **为每个改动添加 Changeset**
   ```bash
   pnpm run changeset
   ```
   根据提示选择影响范围，填写变更说明（建议中英文简述）。

2. **提交代码**（不需改版本号，也不需要修改 CHANGELOG）
   ```bash
   git add .
   git commit -m "feat/fix/..."  # 正常提交
   ```

## 发布前（本地或 Release 分支上）

1. **应用版本与生成 changelog**
   ```bash
   pnpm run changeset:version
   ```
   作用：
   - 根据待发布的 changeset 自动提升 `package.json` 版本号
   - 更新 `CHANGELOG.md`
   - 更新锁文件（`pnpm-lock.yaml`）
   - 自动创建 `vX.Y.Z` Git tag

2. **检查与提交发布前变更**
   ```bash
   git add package.json pnpm-lock.yaml CHANGELOG.md .changeset
   git commit -m "chore: release vX.Y.Z"
   ```

3. **推送**（触发 GitHub Actions 发布）
   ```bash
   git push origin main --tags
   ```
   现有 `release.yml` 会：
   - 使用 Node/PNPM 指定版本构建
   - 运行 lint / compile-tests / compile
   - 打包 VSIX 并发布到 VS Code Marketplace（需要配置好 VSCE_PAT Secret）
   - 创建 GitHub Release（需要 contents: write 权限，已配置）

## 注意事项

- **不要运行** `pnpm dlx changeset publish`：该命令会将包发布到 npm registry，本项目只需发布 VS Code 扩展。
- 每次变更版本号时，务必确保 `CHANGELOG.md` 已由 `changeset version` 自动更新（AGENTS.md 中也有提醒）。
- 若需手动修正 changelog，务必在变更后重新检查版本号与锁文件是否一致。
- 发布失败若需重试：
  - 删除远程 tag：`git push origin :refs/tags/vX.Y.Z`
  - 本地重打 tag：`git tag -f vX.Y.Z`
  - 重新推送：`git push origin vX.Y.Z`
- 新增默认 watch patterns 或配置项时，记得同步更新 README/README.zh-CN 与 CHANGELOG。

## 快速命令清单

- 新建 changeset：`pnpm run changeset`
- 应用版本 & 生成 changelog（含 tag）：`pnpm run changeset:version`
- 发布（触发 CI）：`git push origin main --tags`
