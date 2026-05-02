# Minecraft Bedrock Development Support CLI

マイクラ統合版の開発を支援するCLIツールの仕様書

## deps

- pnpm
- https://github.com/SBoudrias/Inquirer.js
- typescript
- commander

## basic features

## `mcutil`

各core featureをTUIで選択して実行

## `mcutil -v` / `mcutil --version`

バージョン情報を表示

## `mcutil -h` / `mcutil --help`

ヘルプ情報を表示

## core features

### `mcutil link`

今いるフォルダをマイクラ統合版内のアドオンフォルダにリンクする (mklink /D "%TARGET_DIR%" "%CUR_DIR%")

- フォルダ名を指定(text input)
  - デフォルトは現在のparentフォルダ名
- mklink先を選択
  - release: `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\development_behavior_packs\`
  - preview: `%APPDATA%\Minecraft Bedrock Preview\Users\Shared\games\com.mojang\development_behavior_packs\`
  - custom: ユーザーが指定したパス

### `mcutil pkg`

型定義ファイルのインストール支援ツール
対象: `@minecraft/server` `@minecraft/server-ui` `@minecraft/server-net` `@minecraft/server-admin` `@minecraft/vanilla-data`
npm apiからバージョン一覧を取得し、release, stable-beta, preview-beta等で利用可能なバージョンを選択してインストールできるようにする
ちゃんとソートして見やすくする
現在のバージョンもpackage.jsonから取得し、表示する
使用するパッケージマネージャーを自動検出。不明な場合は選択肢を表示

## その他

- core featuresは今後追加予定
  - core featureごとに別のファイルで管理し、拡張しやすいようにする
