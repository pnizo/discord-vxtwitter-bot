# Discord vxTwitter Bot

Twitter/X のURLが投稿されたとき、自動でvxTwitter URLに変換して投稿するDiscord Botです。

## 機能

- `twitter.com` または `x.com` のURLを検出
- 元の投稿のembedを削除
- URLのドメインを `vxtwitter.com` に変換
- GETパラメータ（`?`以降）を削除
- 変換したURLを返信として投稿

## セットアップ

### 1. Discord Bot の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリックしてアプリケーションを作成
3. 左メニューの「Bot」を選択
4. 「Reset Token」をクリックしてトークンを取得（安全な場所に保存）
5. 以下の設定を有効にする：
   - **MESSAGE CONTENT INTENT** - 必須（メッセージ内容を読み取るため）

### 2. Bot の招待

1. 左メニューの「OAuth2」→「URL Generator」を選択
2. **SCOPES** で以下を選択：
   - `bot`
3. **BOT PERMISSIONS** で以下を選択：
   - `Send Messages` - メッセージ送信
   - `Manage Messages` - embedの削除に必要
   - `Read Message History` - メッセージ履歴の読み取り
4. 生成されたURLでBotをサーバーに招待

### 3. 環境設定（ローカル実行の場合）

1. `.env.example` を `.env` にコピー
2. `.env` ファイルにBotトークンを設定

```env
DISCORD_TOKEN=your_bot_token_here
```

### 4. 依存パッケージのインストール

```bash
npm install
```

### 5. Bot の起動

```bash
npm start
```

## デプロイ（Railway）

⚠️ **Vercelはサーバーレス向けのため、常時接続が必要なDiscord Botには向いていません。Railwayを推奨します。**

### Railway でのデプロイ手順

1. [Railway](https://railway.app/) にGitHubアカウントでログイン
2. 「New Project」→「Deploy from GitHub repo」を選択
3. このリポジトリを選択
4. デプロイ後、「Variables」タブで環境変数を設定：
   - `DISCORD_TOKEN` = あなたのBotトークン
5. 自動的にデプロイが開始されます

### その他のホスティングオプション

- **[Render](https://render.com/)** - 無料枠あり
- **[Fly.io](https://fly.io/)** - 無料枠あり
- **[Heroku](https://heroku.com/)** - 有料

## 動作例

**入力:**
```text
https://twitter.com/user/status/123456789?s=20&t=abc
```

**出力:**
```text
https://vxtwitter.com/user/status/123456789
```

## 必要な権限

- **Send Messages** - 変換したURLを送信
- **Manage Messages** - 元のメッセージのembedを削除
- **Read Message History** - メッセージを読み取る

## 注意事項

- Bot Token は絶対に公開しないでください
- `.env` ファイルは `.gitignore` に含まれています
