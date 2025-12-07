require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

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

client.once('ready', () => {
  console.log(`✅ ログインしました: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Bot自身のメッセージは無視
  if (message.author.bot) return;

  // メッセージ内のTwitter/X URLを検索
  const urls = message.content.match(twitterUrlRegex);
  
  if (!urls || urls.length === 0) return;

  try {
    // 変換したURLを作成
    const vxUrls = urls.map(url => convertToVxTwitter(url));
    
    // 元のメッセージのembedを削除（メッセージの編集権限が必要）
    // Botにはメッセージ編集権限がないため、suppressEmbedsを使用
    if (message.suppressEmbeds) {
      await message.suppressEmbeds(true);
    }
    
    // 変換したURLを投稿
    const replyContent = vxUrls.join('\n');
    await message.reply({
      content: replyContent,
      allowedMentions: { repliedUser: false }, // 元の投稿者にメンションしない
    });
    
    console.log(`🔄 URLを変換しました: ${urls.join(', ')} -> ${vxUrls.join(', ')}`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
});

// Botにログイン
client.login(process.env.DISCORD_TOKEN);
