// index.js

const axios = require('axios');
const cheerio = require('cheerio');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// 从环境变量中获取 Token 和 Channel ID，这是在 Zeabur 上部署的最佳实践
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// 检查配置是否存在
if (!BOT_TOKEN || !CHANNEL_ID) {
    console.error('错误：请在环境变量中设置 BOT_TOKEN 和 CHANNEL_ID');
    process.exit(1); // 退出程序
}

// 初始化 Telegram Bot
const bot = new TelegramBot(BOT_TOKEN);

const pagesToScrape = [
    { title: '【Hostloc】今日收藏排行', url: 'https://hostloc.com/misc.php?mod=ranklist&type=thread&view=favtimes&orderby=today' },
    { title: '【Hostloc】本周收藏排行', url: 'https://hostloc.com/misc.php?mod=ranklist&type=thread&view=favtimes&orderby=thisweek' },
    { title: '【Hostloc】本月收藏排行', url: 'https://hostloc.com/misc.php?mod=ranklist&type=thread&view=favtimes&orderby=thismonth' }
];

// Telegram MarkdownV2 格式要求对特定字符进行转义
function escapeMarkdownV2(text) {
    return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}

async function scrapeAndPost() {
    console.log('开始执行抓取任务...');
    for (const page of pagesToScrape) {
        try {
            console.log(`正在抓取: ${page.title}`);
            const response = await axios.get(page.url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
            });
            const $ = cheerio.load(response.data);
            const links = [];
            $('div.tl table tbody tr:not(.th)').each((index, element) => {
                const linkElement = $(element).find('th a');
                const postTitle = linkElement.text().trim();
                const relativeUrl = linkElement.attr('href');
                if (postTitle && relativeUrl) {
                    const fullUrl = new URL(relativeUrl, 'https://hostloc.com/').href;
                    const escapedTitle = escapeMarkdownV2(postTitle);
                    links.push(`[${escapedTitle}](${fullUrl})`);
                }
            });

            if (links.length > 0) {
                const message = `${escapeMarkdownV2(page.title)}\n\n${links.join('\n')}`;
                await bot.sendMessage(CHANNEL_ID, message, { parse_mode: 'MarkdownV2' });
                console.log(`成功发送消息: ${page.title}`);
            } else {
                console.log(`没有找到任何链接: ${page.title}`);
            }
        } catch (error) {
            console.error(`处理 "${page.title}" 时出错:`, error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    }
    console.log('所有抓取任务完成。');
}

// Zeabur 使用 UTC 时间，北京时间(UTC+8) 9点是 UTC 1点
console.log('定时任务已设置，将在每天 UTC 时间 01:00 (北京时间 09:00) 执行。');
cron.schedule('0 1 * * *', () => {
    console.log('触发定时任务！');
    scrapeAndPost();
}, {
    scheduled: true,
    timezone: "Etc/UTC"
});

console.log('程序启动，立即执行一次抓取任务用于测试...');
scrapeAndPost();
