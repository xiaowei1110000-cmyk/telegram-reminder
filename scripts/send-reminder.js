const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ==================== 时间处理 ====================

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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==================== Telegram消息发送 ====================

async function sendTelegramMessage(reminders, dueReminders) {
    if (!TOKEN || !CHAT_ID) {
        console.error('❌ 未配置Telegram');
        return false;
    }

    const today = getTodayString();
    let message = '';
    
    // ========== 头部框线 ==========
    message += `╔════════════════════════════╗\n`;
    message += `║  🔔 域名更换提醒 \n`;
    message += `╚════════════════════════════╝\n\n`;
    
    // ========== 每个项目的卡片（只显示群组名称） ==========
    dueReminders.forEach((item, index) => {
        const nextDate = getNextDate(today, item.days);
        
        message += `┌─[ #${index + 1} ${item.name} ]\n`;
        message += `│  📅 上次更新 · ⚪️ ${formatDate(item.lastUpdated)}\n`;
        message += `│  ⏰ 提醒时间 · 🔴 今天\n`;
        message += `│  📊 间隔周期 · ${item.days}天\n`;
        message += `│  ⏩ 下次提醒 · 🔴 ${formatDate(nextDate)}\n`;
        message += `│  ⏱️ 剩余时间 · ⚠️ 今日到期\n`;
        message += `└⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯⋯┘\n\n`;
    });
    
    // ========== 今日需要处理项目（每个项目单独一行） ==========
    message += `📊 今日需要处理项目\n`;
    
    dueReminders.forEach((item) => {
        message += `├─ 到期项目: ${item.name}\n`;
    });
    
    // ========== 底部 ==========
    message += `\n⚡️ 发送时间 ${new Date().toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}`;

    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });

        const req = https.request(
            `https://api.telegram.org/bot${TOKEN}/sendMessage`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            },
            (res) => {
                let response = '';
                res.on('data', chunk => response += chunk);
                res.on('end', () => {
                    const success = res.statusCode === 200;
                    console.log(`${success ? '✅' : '❌'} Telegram响应: ${res.statusCode}`);
                    resolve(success);
                });
            }
        );

        req.on('error', (e) => {
            console.error('❌ 发送失败:', e.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

// ==================== 主程序 ====================

async function main() {
    console.log('\n' + '='.repeat(50));
    console.log('  🤖 Telegram定时提醒系统');
    console.log('='.repeat(50) + '\n');
    
    const today = getTodayString();
    console.log(`  📅 北京时间: ${today}\n`);
    
    // 1. 读取数据
    let reminders = [];
    try {
        const rootFile = path.join(__dirname, '..', 'reminders.json');
        if (fs.existsSync(rootFile)) {
            reminders = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
            
            // 修复日期格式
            reminders.forEach(r => {
                if (r.nextReminder) r.nextReminder = fixDate(r.nextReminder);
                if (r.lastUpdated) r.lastUpdated = fixDate(r.lastUpdated);
                if (!r.nextReminder) {
                    r.nextReminder = getNextDate(r.lastUpdated, r.days);
                }
                if (r.enabled === undefined) r.enabled = true;
            });
            
            console.log(`  📖 已加载 ${reminders.length} 个提醒`);
        } else {
            // 默认数据
            reminders = [
                {
                    id: Date.now(),
                    name: "111",
                    lastUpdated: "2026-02-11",
                    nextReminder: today,
                    days: 1,
                    enabled: true
                }
            ];
            console.log('  📝 创建默认提醒');
        }
    } catch (e) {
        console.error('  ❌ 读取失败:', e.message);
        reminders = [];
    }
    
    // 2. 筛选今日到期提醒
    const dueReminders = reminders.filter(r => r.enabled && r.nextReminder === today);
    console.log(`  🔍 今日到期: ${dueReminders.length} 个\n`);
    
    // 3. 发送消息并自动更新
    let sendSuccess = false;
    
    if (dueReminders.length > 0) {
        // 发送提醒
        sendSuccess = await sendTelegramMessage(reminders, dueReminders);
        
        if (sendSuccess) {
            // ✅ 自动更新下次提醒日期
            dueReminders.forEach(r => {
                r.lastUpdated = today;
                r.nextReminder = getNextDate(today, r.days);
                r.lastNotified = new Date().toISOString();
            });
            console.log('  ✅ 已自动更新下次提醒日期\n');
        }
    } else {
        console.log('  ℹ️ 今日无到期提醒，跳过发送\n');
    }
    
    // 4. 保存数据
    try {
        // 确保日期格式正确
        reminders.forEach(r => {
            if (r.nextReminder) r.nextReminder = fixDate(r.nextReminder);
            if (r.lastUpdated) r.lastUpdated = fixDate(r.lastUpdated);
        });
        
        // 保存到 data 目录
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(dataDir, 'reminders.json'),
            JSON.stringify(reminders, null, 2),
            'utf8'
        );
        
        // 保存到根目录
        fs.writeFileSync(
            path.join(__dirname, '..', 'reminders.json'),
            JSON.stringify(reminders, null, 2),
            'utf8'
        );
        
        console.log('  💾 数据已保存');
    } catch (e) {
        console.error('  ❌ 保存失败:', e.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('  ✨ 执行完成');
    console.log('='.repeat(50) + '\n');
}

// 启动
main().catch(console.error);
