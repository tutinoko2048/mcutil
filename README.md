# mcutil

Minecraft Bedrock Edition（統合版）のアドオン開発を支援するCLIツールです。

(This is a vibe-coded project mainly for my personal use)

## 機能

### 🔗 `link`
現在のフォルダをMinecraftの開発用リソースパック/ビヘイビアパックフォルダへリンクします。
Windowsの `mklink /D` 相当の処理を行うため、即座に実機で確認できるようになります。

- **Release / Preview** 版のどちらへリンクするか選択可能
- フォルダ名の指定が可能（デフォルトは現在のフォルダ名）
- **注意**: シンボリックリンクの作成には**管理者権限**が必要です。

### 📦 `pkg`
`@minecraft/server` などの主要パッケージのバージョン管理を支援します。

- npmレジストリからバージョン一覧を取得し、以下のカテゴリごとに分類およびソートして表示します：
  - `release`, `stable-beta`, `preview-beta`, `beta`, `rc`, `preview`
- 現在プロジェクトにインストールされているバージョンも表示
- プロジェクトのパッケージマネージャ（`pnpm`, `npm`, `yarn`, `bun`）を自動検出してインストール

## 使い方

### インストール
```bash
npm install -g @tutinoko2048/mcutil
```

### 実行
```bash
# 対話モードで機能を選択
mcutil

# Link機能の直接実行（管理者権限推奨）
mcutil link

# Pkg機能の直接実行
mcutil pkg
```

## 動作環境
- Windows (Minecraft Bedrock Edition)
- Node.js
