const https = require('https');
const fs = require('fs');
const path = require('path');

// 文件路径
const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 获取北京时间今天
function getToday() {
    const d = new Date(new Date().getTime() + 8 * 3600000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// 计算下次提醒日期
function nextDate(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 发送Telegram消息
async function sendTelegram(message) {
    if (!TOKEN || !CHAT_ID) {
        console.log('❌ 未配置Token或Chat ID');
        return false;
    }
    
    return new Promise((resolve) => {
        const data = JSON.stringify({
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
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
                    console.log(`✅ Telegram响应: ${res.statusCode}`);
                    resolve(res.statusCode === 200);
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

// 主函数
async function main() {
    console.log('🚀 Telegram提醒机器人启动');
    const today = getToday();
    console.log(`📅 北京时间: ${today}`);
    
    // 1. 读取提醒数据
    let reminders = [];
    try {
        // 尝试读取根目录的 reminders.json（你已有的文件）
        const rootFile = path.join(__dirname, '..', 'reminders.json');
        if (fs.existsSync(rootFile)) {
            reminders = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
            console.log(`📖 已加载 ${reminders.length} 个提醒`);
        } else {
            // 创建默认数据
            reminders = [
                { 
                    id: Date.now(), 
                    name: "网宿IP更新", 
                    lastUpdated: today, 
                    nextReminder: today, 
                    days: 3, 
                    enabled: true 
                },
                { 
                    id: Date.now() + 1, 
                    name: "周报提交", 
                    lastUpdated: "2026-02-09", 
                    nextReminder: "2026-02-16", 
                    days: 7, 
                    enabled: true 
                }
            ];
            console.log('📝 创建默认提醒');
        }
    } catch (e) {
        console.error('❌ 读取失败:', e.message);
        reminders = [];
    }
    
    // 2. 筛选今日到期提醒
    const dueReminders = reminders.filter(r => r.enabled !== false && r.nextReminder === today);
    console.log(`🔍 今日到期: ${dueReminders.length} 个`);
    
    // 3. 发送提醒
    if (dueReminders.length > 0) {
        let message = `📢 <b>今日提醒 · ${today}</b>\n\n`;
        dueReminders.forEach((r, i) => {
            message += `${i + 1}. ${r.name}\n`;
            message += `   下次提醒: ${nextDate(today, r.days)}\n\n`;
        });
        
        const success = await sendTelegram(message);
        
        if (success) {
            dueReminders.forEach(r => {
                r.lastUpdated = today;
                r.nextReminder = nextDate(today, r.days);
            });
            console.log('✅ 已更新下次提醒日期');
        }
    } else {
        console.log('ℹ️ 今日无提醒');
        await sendTelegram(`💓 系统心跳 · ${today}\n\n今日无到期提醒。`);
    }
    
    // 4. 保存数据
    try {
        // 创建data目录（如果不存在）
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // 保存到 data/reminders.json
        fs.writeFileSync(path.join(dataDir, 'reminders.json'), JSON.stringify(reminders, null, 2));
        // 同时也保存到根目录
        fs.writeFileSync(path.join(__dirname, '..', 'reminders.json'), JSON.stringify(reminders, null, 2));
        
        console.log('💾 数据已保存');
    } catch (e) {
        console.error('❌ 保存失败:', e.message);
    }
    
    console.log('✨ 执行完成');
}

main().catch(console.error);
