require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const http = require('http');
const { Pool } = require('pg');

// PostgreSQL接続（Railway では DATABASE_URL が自動設定される）
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('🗄️ PostgreSQL に接続します');
}

// ユーザー設定をメモリにキャッシュ
let userSettings = { enabledUsers: [] };

/**
 * データベースの初期化（テーブル作成）
 */
async function initDatabase() {
  if (!pool) return;
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id VARCHAR(255) PRIMARY KEY,
        enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ データベーステーブルを初期化しました');
    
    // 既存のユーザー設定を読み込み
    await loadUserSettings();
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
  }
}

/**
 * ユーザー設定を読み込む
 */
async function loadUserSettings() {
  if (!pool) {
    console.log('⚠️ DATABASE_URL が設定されていません。メモリ内でのみ動作します。');
    return;
  }
  
  try {
    const result = await pool.query('SELECT user_id FROM user_settings WHERE enabled = true');
    userSettings.enabledUsers = result.rows.map(row => row.user_id);
    console.log(`📋 ${userSettings.enabledUsers.length} 人のユーザー設定を読み込みました`);
  } catch (error) {
    console.error('設定の読み込みエラー:', error);
  }
}

/**
 * ユーザー設定を保存する
 * @param {string} userId ユーザーID
 * @param {boolean} enabled 有効/無効
 */
async function saveUserSetting(userId, enabled) {
  // メモリキャッシュを更新
  const index = userSettings.enabledUsers.indexOf(userId);
  if (enabled && index === -1) {
    userSettings.enabledUsers.push(userId);
  } else if (!enabled && index !== -1) {
    userSettings.enabledUsers.splice(index, 1);
  }
  
  // データベースに保存
  if (!pool) return;
  
  try {
    if (enabled) {
      await pool.query(
        'INSERT INTO user_settings (user_id, enabled) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET enabled = true',
        [userId]
      );
    } else {
      await pool.query(
        'UPDATE user_settings SET enabled = false WHERE user_id = $1',
        [userId]
      );
    }
  } catch (error) {
    console.error('設定の保存エラー:', error);
  }
}

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
    GatewayIntentBits.GuildMembers, // ロール割り当てに必要
  ],
  partials: [Partials.Message, Partials.Channel],
});

// 再接続・エラーハンドリング
client.on('error', (error) => {
  console.error('❌ Discordクライアントエラー:', error);
});

client.on('warn', (warning) => {
  console.warn('⚠️ 警告:', warning);
});

client.on('disconnect', () => {
  console.log('🔌 Discord から切断されました。再接続を試みます...');
});

client.on('reconnecting', () => {
  console.log('🔄 再接続中...');
});

client.on('shardResume', () => {
  console.log('✅ 接続が再開されました');
});

// Botがサーバーに参加した時の処理
client.on('guildCreate', async (guild) => {
  console.log(`🎉 新しいサーバーに参加しました: ${guild.name}`);
  
  try {
    // Bot用のロールを作成
    const botRoleName = 'X-URL-rewrite Bot';
    
    // 既存のロールをチェック
    let botRole = guild.roles.cache.find(role => role.name === botRoleName);
    
    if (!botRole) {
      // ロールを新規作成
      botRole = await guild.roles.create({
        name: botRoleName,
        color: '#1DA1F2', // Twitterブルー
        reason: 'X-URL-rewrite Bot 用のロール',
        permissions: [
          'SendMessages',
          'ManageMessages', // embed削除用
          'ReadMessageHistory',
          'ViewChannel',
        ],
      });
      console.log(`✅ ロールを作成しました: ${botRole.name}`);
    }
    
    // Botにロールを割り当て
    const botMember = guild.members.cache.get(client.user.id);
    if (botMember && !botMember.roles.cache.has(botRole.id)) {
      await botMember.roles.add(botRole);
      console.log(`✅ Botにロールを割り当てました: ${botRole.name}`);
    }
  } catch (error) {
    console.error(`❌ ロール作成/割り当てエラー (${guild.name}):`, error.message);
  }
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

  // データベースを初期化
  await initDatabase();

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

    // 設定を保存
    await saveUserSetting(user.id, isEnabled);

    if (isEnabled) {
      await interaction.reply({
        content: '✅ **Twitter/X URL自動変換を有効にしました！**\nあなたが投稿したTwitter/XのURLは自動的にvxTwitterに変換されます。',
        ephemeral: true, // 本人にのみ表示
      });
    } else {
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

  // 部分的なメッセージの場合はフェッチ
  if (message.partial) {
    try {
      message = await message.fetch();
    } catch (error) {
      console.error('メッセージのフェッチに失敗:', error);
      return;
    }
  }

  // メッセージ内のTwitter/X URLを検索
  const urls = message.content.match(twitterUrlRegex);
  
  if (!urls || urls.length === 0) return;

  // ユーザーが自動変換を有効にしているかチェック
  if (!userSettings.enabledUsers.includes(message.author.id)) {
    console.log(`⏭️ ユーザー ${message.author.tag} は自動変換が無効のためスキップ`);
    return;
  }

  console.log(`📨 Twitter/X URLを検出: ${message.author.tag} - ${urls.join(', ')}`);

  try {
    // 変換したURLを作成
    const vxUrls = urls.map(url => convertToVxTwitter(url));
    
    // 元のメッセージのembedを削除（メッセージの編集権限が必要）
    // Botにはメッセージ編集権限がないため、suppressEmbedsを使用
    try {
      await message.suppressEmbeds(true);
    } catch (embedError) {
      console.warn('⚠️ embed削除に失敗（権限不足の可能性）:', embedError.message);
    }
    
    // 変換したURLを投稿
    const replyContent = vxUrls.join('\n');
    await message.reply({
      content: replyContent,
      allowedMentions: { repliedUser: false }, // 元の投稿者にメンションしない
    });
    
    console.log(`✅ URLを変換しました: ${urls.join(', ')} -> ${vxUrls.join(', ')}`);
  } catch (error) {
    console.error('❌ URL変換処理でエラー:', error);
  }
});

// Botにログイン
client.login(process.env.DISCORD_TOKEN);
