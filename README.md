# DJMAX 身内ランキング (GitHub Pages)

GitHub Pages上で動く、シンプルなDJMAXスコアランキングです。

- 利用者ページ: `index.html`
- 管理者ページ: `admin.html`
- アカウント管理なし
- 利用者用と管理者用で別パスワード
- 管理者ページでスコア登録
- 利用者ページでランキング表示
- Google Apps Script + Google Drive JSON で共有保存対応

## 初期パスワード

- 利用者用: `123455`
- 管理者用: `djmax-admin`

`common.js` の `PASSWORD_HASHES` を変更すれば差し替えできます。

## 使い方

1. 管理者ページ (`admin.html`) へアクセス
2. ユーザー名・曲名・ボタン数・難易度・スコアを入力して登録
3. 利用者ページ (`index.html`) でランキング確認

## データ保存について

デフォルトではブラウザの `localStorage` に保存されます。

`common.js` の `REMOTE_CONFIG.apiUrl` を設定すると、Google Apps Script経由でGoogle Drive上のJSONを共有データとして利用できます。

- 端末ごとにデータは分かれます
- 共有API接続時は複数端末で同じデータを参照・更新できます
- 共有API接続に失敗した場合は自動でローカル保存へフォールバックします

## Google Apps Script 設定

1. Google Apps Scriptで新規プロジェクトを作成
2. `apps-script/Code.gs` の内容を貼り付け
3. 必要なら `READ_TOKEN` と `WRITE_TOKEN` を変更
4. 共有ドライブ配下に保存したい場合は `TARGET_FOLDER_ID` にフォルダIDを設定
5. `デプロイ` -> `新しいデプロイ` -> `ウェブアプリ`
6. 実行ユーザー: 自分、アクセス: `全員`
7. 発行されたWebアプリURLを `config.js` の `apiUrl` に設定
8. `config.js` の `readToken` と `writeToken` を Apps Script 側と一致させる

## フロント設定ファイル

- `config.js` を編集して接続先を設定します
- 雛形は `config.example.js` にあります
- 設定が空のときは従来どおりローカル保存モードで動作します

## 共有JSONの配置

- Apps Script 実行アカウントのGoogle Drive直下に `djmax-ranking-data.json` が自動作成されます
- 共有Drive配下で運用したい場合は、Apps Script側で作成先フォルダ指定ロジックを追加してください

## GitHub Pages 公開手順

1. このフォルダをGitHubリポジトリにpush
2. GitHubの `Settings` -> `Pages`
3. `Build and deployment` で `Deploy from a branch` を選択
4. ブランチに `main`、フォルダに `/ (root)` を選択
5. 数分後に公開URLが発行される

## 注意

このパスワード保護はクライアントサイド実装です。厳密なセキュリティが必要な用途には向きません。
