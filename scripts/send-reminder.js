const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function getBeijingTime() {
    const now = new Date();
    return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

function getTodayString() {
    const beijing = getBeijingTime();
    const year = beijing.getUTCFullYear();
    const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijing.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fixDate(dateStr) {
    if (!dateStr) return dateStr;
    return dateStr.split('T')[0];
}

function getNextDate(lastDate, days) {
    const date = new Date(lastDate.split('T')[0]);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(dateStr) {
    const today = getTodayString();
    const targetDate = fixDate(dateStr);
    
    if (targetDate === today) return '🔴 今天';
    if (targetDate === getNextDate(today, 1)) return '🟡 明天';
    if (targetDate === getNextDate(today, 2)) return '🟢 后天';
    
    const date = new Date(targetDate);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${month}月${day}日(周${weekdays[date.getDay()]})`;
}

async function sendTelegramMessage(reminders, dueItems) {
    if (!TOKEN || !CHAT_ID) return false;

    const today = getTodayString();
    const todayDate = new Date(today);
    const month = todayDate.getMonth() + 1;
    const day = todayDate.getDate();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[todayDate.getDay()];
    
    let message = '';
    message += `📌 <b>今日到期提醒</b>\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📆 ${month}月${day}日 星期${weekday}\n\n`;
    
    dueItems.forEach((item, index) => {
        const nextDate = getNextDate(today, item.days);
        message += `<b>${index + 1}. ${item.name}</b>\n`;
        message += `   ├─ 上次更新：${formatDate(item.lastUpdated)}\n`;
        message += `   ├─ 间隔周期：${item.days}天\n`;
        message += `   └─ ⏰ 下次提醒：${formatDate(nextDate)}\n\n`;
    });
    
    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `✅ 已自动更新下次提醒时间\n`;
    message += `⚡️ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' })}`;

    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });

        const req = https.request(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let response = '';
            res.on('data', chunk => response += chunk);
            res.on('end', () => resolve(res.statusCode === 200));
        });

        req.on('error', () => resolve(false));
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🚀 Telegram提醒系统启动');
    const today = getTodayString();
    console.log(`📅 北京时间: ${today}`);
    
    let reminders = [];
    try {
        const rootFile = path.join(__dirname, '..', 'reminders.json');
        if (fs.existsSync(rootFile)) {
            reminders = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
            reminders.forEach(r => {
                r.nextReminder = fixDate(r.nextReminder);
                r.lastUpdated = fixDate(r.lastUpdated);
                if (!r.nextReminder) r.nextReminder = getNextDate(r.lastUpdated, r.days);
                if (r.enabled === undefined) r.enabled = true;
            });
        }
    } catch (e) {
        console.error('❌ 读取失败:', e.message);
        return;
    }
    
    const dueReminders = reminders.filter(r => r.enabled && r.nextReminder === today);
    console.log(`🔍 今日到期: ${dueReminders.length} 个`);
    
    if (dueReminders.length > 0) {
        const success = await sendTelegramMessage(reminders, dueReminders);
        
        if (success) {
            dueReminders.forEach(r => {
                r.lastUpdated = today;
                r.nextReminder = getNextDate(today, r.days);
                r.lastNotified = new Date().toISOString();
            });
            console.log('✅ 已自动更新下次提醒日期');
        }
    }
    
    // 保存数据
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        
        fs.writeFileSync(path.join(dataDir, 'reminders.json'), JSON.stringify(reminders, null, 2));
        fs.writeFileSync(path.join(__dirname, '..', 'reminders.json'), JSON.stringify(reminders, null, 2));
        console.log('💾 数据已保存');
    } catch (e) {
        console.error('❌ 保存失败:', e.message);
    }
    
    console.log('✨ 执行完成');
}

main().catch(console.error);
