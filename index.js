require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const http = require('http');

// ヘルスチェック用のHTTPサーバー（Railwayでコンテナを維持するため）
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is running!');
}).listen(PORT, () => {
  console.log(`🌐 ヘルスチェックサーバー起動: ポート ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message],
});

// Twitter/X URLを検出する正規表現
const twitterUrlRegex = /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s]+/gi;

/**
 * Twitter/X URLをvxTwitter URLに変換する
 * @param {string} url - 元のURL
 * @returns {string} - 変換後のURL
 */
function convertToVxTwitter(url) {
  // URLオブジェクトを使ってパース
  const urlObj = new URL(url);
  
  // ドメインをvxtwitter.comに変更
  urlObj.hostname = 'vxtwitter.com';
  
  // GETパラメータを削除（searchを空にする）
  urlObj.search = '';
  
  return urlObj.toString();
}

client.once('clientReady', () => {
  console.log(`✅ ログインしました: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Bot自身のメッセージは無視
  if (message.author.bot) return;

  // メッセージ内のTwitter/X URLを検索
  const urls = message.content.match(twitterUrlRegex);
  
  if (!urls || urls.length === 0) return;

  try {
    // 元のメッセージ内容を取得
    const originalContent = message.content;
    const author = message.author;
    
    // URLをvxTwitterに変換した新しいメッセージ内容を作成
    let newContent = originalContent;
    urls.forEach(url => {
      const vxUrl = convertToVxTwitter(url);
      newContent = newContent.replace(url, vxUrl);
    });
    
    // 元のメッセージを削除
    await message.delete();
    
    // 元の投稿者の情報を含めて再投稿
    await message.channel.send({
      content: `**${author.displayName}**: ${newContent}`,
    });
    
    console.log(`🔄 URLを変換しました: ${urls.join(', ')}`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
});

// Botにログイン
client.login(process.env.DISCORD_TOKEN);
