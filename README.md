# 文鳥休憩タイマー MVP

macOS 向けの、自動で一定間隔ごとに休憩オーバーレイを出すローカルデスクトップアプリです。  
文鳥動画 + ランダム音声付きで最小構成から動かせるようにしています。

## 1. 構成

今回は **Electron + プレーン HTML/CSS/JS** を採用しています。

理由は、今回の要件で必要な以下を最短で満たしやすいためです。

- アプリ起動時の自動タイマー開始
- メニューバー常駐
- 全画面オーバーレイ表示
- `assets/videos/*` のランダム再生
- `assets/sounds/*.wav` のランダム再生
- `assets/stop_sounds/*` のランダム再生
- ローカル設定保存

React や Vite は今回あえて入れていません。MVP 段階ではビルドレスで早く動かせる方を優先しています。

## 2. ファイル構成

```text
.
├── README.md
├── package.json
├── assets
│   ├── sounds
│   │   └── .gitkeep
│   ├── stop_sounds
│   │   └── .gitkeep
│   └── videos
│       └── .gitkeep
├── renderer
│   ├── overlay.css
│   ├── overlay.html
│   ├── overlay.js
│   ├── settings.css
│   ├── settings.html
│   └── settings.js
└── src
    ├── constants.js
    ├── main.js
    ├── preload.js
    └── settings-store.js
```

## 3. 実装した MVP

### 休憩タイマー

- アプリ起動時に自動でタイマー開始
- デフォルト 30 分ごとに休憩表示
- 休憩終了後、自動で次のタイマー開始
- 一時停止 / 再開
- 次の休憩をスキップ
- 今すぐ休憩を表示

### 文鳥オーバーレイ

- 画面中央にオーバーレイ表示
- 半透明の暗幕背景
- `assets/videos` 配下の動画をランダムで 1 つ再生
- `assets/sounds/*.wav` からランダムで 1 つ再生
- `assets/stop_sounds/*` から休憩終了時にランダムで 1 つ選び、ランダムな 5 秒間だけ再生
- 音声ファイルが 0 個でも無音で継続
- 動画がない場合はアプリを落とさず代替メッセージ表示
- 初期表示 60 秒
- 閉じるボタンは初期 10 秒無効
- 時間経過後にボタン有効化
- 表示時間満了でオーバーレイ内の状態を「休憩終了」に切り替え、手動で閉じるまで表示継続

### 設定画面

- 休憩通知の間隔
- オーバーレイ表示時間
- 音声を鳴らすかどうか
- 起動時に自動でタイマーを開始するかどうか

設定は Electron の `userData` 配下に `settings.json` として保存されます。

## 4. 開発時の起動方法

### 前提

- macOS
- Node.js 22 系前後
- `assets/videos/*`
- 必要なら `assets/sounds/*.wav`
- 必要なら `assets/stop_sounds/*`

### セットアップ

1. 依存をインストールします

```bash
npm install
```

2. 動画を配置します

```text
assets/videos/*
```

3. 必要なら音声を配置します

```text
assets/sounds/*.wav
```

4. 必要なら休憩終了SEを配置します

```text
assets/stop_sounds/*
```

5. アプリを起動します

```bash
npm start
```

### 使い方

- 起動すると設定画面が開き、同時にタイマーが自動開始されます
- メニューバーから `一時停止` `再開` `次の休憩をスキップ` `今すぐ休憩を表示` を操作できます
- 設定画面でも同じ操作ができます

## 5. 配布用ビルド

このリポジトリには、macOS 向けに `.app` / `.dmg` / `.zip` を作るための `electron-builder` 設定が入っています。

### ローカルで配布物を作る

```bash
npm run pack:mac
```

- `dist/mac-universal/` に、未圧縮の `.app` 相当が出力されます
- 自分の Mac でまず動作確認したいとき向けです

```bash
npm run dist:mac
```

- `dist/` に配布向けの `.dmg` と `.zip` が出力されます
- Universal build なので、Intel Mac と Apple Silicon Mac の両方で使えます

### 署名と notarization

Apple Developer の証明書と認証情報を設定すると、`npm run dist:mac` 時に署名と notarization まで進められます。  
直接配布する場合は、最終的にこの状態にするのがおすすめです。

必要な代表例:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCDE12345"
```

証明書は `Developer ID Application` を使います。  
未署名ビルドでもローカル確認はできますが、他の人に配ると Gatekeeper に止められやすくなります。

### アセット配置

動画・音声アセットは配布ビルド時に `Resources/assets` へコピーされるので、開発時と同じコードで再生できます。

### アプリアイコン

配布用の mac アプリアイコンは `build/icon.svg` を元に `build/icon.icns` を生成しています。

## 6. 今後追加できる機能

- 複数モニターそれぞれへのオーバーレイ表示
- macOS ログイン時の自動起動
- 休憩中だけ最前面固定をさらに強める設定
- 休憩パターンを「軽いストレッチ」「水分補給」などで切り替える機能
