# DJMAX 身内ランキング (GitHub Pages)

GitHub Pages上で動く、シンプルなDJMAXスコアランキングです。

- 利用者ページ: `index.html`
- 管理者ページ: `admin.html`
- アカウント管理なし
- 利用者用と管理者用で別パスワード
- 管理者ページでプレイヤー管理
- 利用者ページでスコア入力とランキング表示
- Google Apps Script + Google Drive JSON で共有保存対応

## 初期パスワード

- 利用者用: `123455`
- 管理者用: `djmax-admin`

`common.js` の `PASSWORD_HASHES` を変更すれば差し替えできます。

## 使い方

1. 管理者ページ (`admin.html`) へアクセス
2. スコア入力で使うプレイヤーを追加/削除
3. 利用者ページ (`index.html`) でプレイヤー名・曲名・ボタン数・難易度・スコアを入力
4. 利用者ページでランキング確認

### リザルト画像から自動入力 (フロント完結)

利用者ページの「リザルト画像から自動入力 (ベータ)」で画像を選ぶと、
ブラウザ内OCRで以下を自動入力できます。

- 曲名 (カタログとのあいまい一致 + 候補3件表示)
- ボタン数 (`4B/5B/6B/8B`)
- 難易度 (`NORMAL/HARD/MAXIMUM/SC`)
- スコア

ファイル選択のほか、利用者ページ上で `Ctrl+V` による画像貼り付けにも対応しています。

### OCRレイアウトの管理者調整

管理者ページに「OCRレイアウト調整」機能があります。

1. プレビュー画像を読み込む
2. プリセットを選択または新規作成する
3. `button/song/difficulty/score` 領域を選び、`X/Y/W/H` スライダーで矩形を調整する
4. 「保存」で利用者ページのOCRへ反映する

補足:

- レイアウト設定はブラウザ `localStorage` に保存されます
- 「JSON書き出し/読込」で他端末への配布も可能です
- 共有API (`config.js` の `apiUrl`) を設定している場合、OCRレイアウトはGoogle Drive上の `djmax-ocr-layout.json` に保存され、全利用者で共有されます
- OCRレイアウトファイルはランキング本体 (`djmax-ranking-data.json`) とは別ファイルで管理されます

注意:

- OCRは画像品質や解像度に依存するため、確定前に必ず内容を確認してください
- 解析はブラウザ内で完結し、画像ファイルはサーバーへ送信されません

## データ保存について

デフォルトではブラウザの `localStorage` に保存されます。

`config.js` の `apiUrl` を設定すると、Google Apps Script経由でGoogle Drive上のJSONを共有データとして利用できます。

- 端末ごとにデータは分かれます
- 共有API接続時は複数端末で同じデータを参照・更新できます
- 共有API接続に失敗した場合は自動でローカル保存へフォールバックします

### 曲リストをGoogle Drive JSONから読む

`config.js` の `catalogMode` を `drive-file` にすると、曲リストは共有状態ファイルではなく
Google Drive 上の `djmax-song-catalog.json` から読み込みます。

- 対象データ: `songs`, `buttons`, `difficulties`
- `users` は従来どおり共有状態 (`djmax-ranking-data.json`) 側を使います

## Google Apps Script 設定

1. Google Apps Scriptで新規プロジェクトを作成
2. `apps-script/Code.gs` の内容を貼り付け
3. 必要なら `READ_TOKEN` と `WRITE_TOKEN` を変更
4. 共有ドライブ配下に保存したい場合は `TARGET_FOLDER_ID` にフォルダIDを設定
5. `デプロイ` -> `新しいデプロイ` -> `ウェブアプリ`
6. 実行ユーザー: 自分、アクセス: `全員`
7. 発行されたWebアプリURLを `config.js` の `apiUrl` に設定
8. `config.js` の `readToken` と `writeToken` を Apps Script 側と一致させる
9. 曲リストをDrive管理する場合は `config.js` に `catalogMode: "drive-file"` を設定
10. Apps Script を再デプロイして最新コードを反映

※ OCRレイアウト共有機能を使う場合は、`apps-script/Code.gs` を更新後に必ず再デプロイしてください。

## フロント設定ファイル

- `config.js` を編集して接続先を設定します
- 雛形は `config.example.js` にあります
- 設定が空のときは従来どおりローカル保存モードで動作します

## 共有JSONの配置

- Apps Script 実行アカウントのGoogle Drive直下に `djmax-ranking-data.json` が自動作成されます
- `catalogMode: "drive-file"` の場合は `djmax-song-catalog.json` も自動作成されます
- 共有Drive配下で運用したい場合は、Apps Script側で作成先フォルダ指定ロジックを追加してください

## Wikiから曲カタログJSONを生成

`https://w.atwiki.jp/djmaxinfo/pages/169.html#id_12f23f32` の表を元に、
「曲名 + ボタン別難易度」を持つインポート用JSONを生成できます。

### 1. 対象ページをHTMLとして保存

Cloudflare保護の都合で自動ダウンロードが失敗することがあるため、ブラウザで以下を実施してください。

1. 対象ページを開く
2. `ページを保存` で `HTMLのみ` または `完全` 形式で保存
3. 例: `wiki-169.html`

### 2. 生成スクリプトを実行

```bash
node scripts/generate-catalog-from-wiki.mjs --in ./wiki-169.html --out ./catalog.from-wiki.json
```

出力JSONは以下の形式です。

- `catalog.songs[].difficultiesByButton` に `4B/5B/6B/8B` ごとの難易度が入る
- `records` は空配列（管理者ページのJSON読込でそのまま取り込み可能）

### 3. 管理者ページから読み込み

1. `admin.html` にログイン
2. `JSON読込` から `catalog.from-wiki.json` を選択
3. 既存データにマージされます

## GitHub Pages 公開手順

1. このフォルダをGitHubリポジトリにpush
2. GitHubの `Settings` -> `Pages`
3. `Build and deployment` で `Deploy from a branch` を選択
4. ブランチに `main`、フォルダに `/ (root)` を選択
5. 数分後に公開URLが発行される

## 注意

このパスワード保護はクライアントサイド実装です。厳密なセキュリティが必要な用途には向きません。
