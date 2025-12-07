require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ユーザー設定を保存するファイルパス
// Railway では /data にボリュームをマウントして永続化
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'user_settings.json');

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * ユーザー設定を読み込む
 * @returns {Object} ユーザー設定オブジェクト
 */
function loadUserSettings() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('設定ファイルの読み込みエラー:', error);
  }
  return { enabledUsers: [] };
}

/**
 * ユーザー設定を保存する
 * @param {Object} settings ユーザー設定オブジェクト
 */
function saveUserSettings(settings) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('設定ファイルの保存エラー:', error);
  }
}

// ユーザー設定を読み込み
let userSettings = loadUserSettings();

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

client.once('clientReady', async () => {
  console.log(`✅ ログインしました: ${client.user.tag}`);

  // スラッシュコマンドを登録
  const commands = [
    new SlashCommandBuilder()
      .setName('replace')
      .setDescription('Twitter/X URLの自動変換機能をON/OFFします')
      .addStringOption(option =>
        option
          .setName('setting')
          .setDescription('ON または OFF を選択')
          .setRequired(true)
          .addChoices(
            { name: 'ON - 自動変換を有効にする', value: 'on' },
            { name: 'OFF - 自動変換を無効にする', value: 'off' }
          )
      ),
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('現在の自動変換設定を確認します'),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('📝 スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ スラッシュコマンドの登録完了');
  } catch (error) {
    console.error('スラッシュコマンドの登録エラー:', error);
  }
});

// スラッシュコマンドの処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user } = interaction;

  if (commandName === 'replace') {
    const setting = interaction.options.getString('setting');
    const isEnabled = setting === 'on';
    const userIndex = userSettings.enabledUsers.indexOf(user.id);

    if (isEnabled) {
      // ONにする
      if (userIndex === -1) {
        userSettings.enabledUsers.push(user.id);
        saveUserSettings(userSettings);
      }
      await interaction.reply({
        content: '✅ **Twitter/X URL自動変換を有効にしました！**\nあなたが投稿したTwitter/XのURLは自動的にvxTwitterに変換されます。',
        ephemeral: true, // 本人にのみ表示
      });
    } else {
      // OFFにする
      if (userIndex !== -1) {
        userSettings.enabledUsers.splice(userIndex, 1);
        saveUserSettings(userSettings);
      }
      await interaction.reply({
        content: '❌ **Twitter/X URL自動変換を無効にしました。**\nあなたの投稿は変換されなくなります。',
        ephemeral: true,
      });
    }

    console.log(`⚙️ ユーザー ${user.tag} が自動変換を ${isEnabled ? 'ON' : 'OFF'} にしました`);
  }

  if (commandName === 'status') {
    const isEnabled = userSettings.enabledUsers.includes(user.id);
    await interaction.reply({
      content: isEnabled
        ? '✅ **あなたの自動変換は現在 ON です。**\n`/replace` コマンドで変更できます。'
        : '❌ **あなたの自動変換は現在 OFF です。**\n`/replace` コマンドで有効にできます。',
      ephemeral: true,
    });
  }
});

client.on('messageCreate', async (message) => {
  // Bot自身のメッセージは無視
  if (message.author.bot) return;

  // ユーザーが自動変換を有効にしているかチェック
  if (!userSettings.enabledUsers.includes(message.author.id)) return;

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
