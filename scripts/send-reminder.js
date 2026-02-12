const https = require('https');
const fs = require('fs');
const path = require('path');

// 文件路径
const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 获取今天的日期字符串
function getTodayDateString() {
    const now = new Date();
    const beijing = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = beijing.getUTCFullYear();
    const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijing.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 修复日期格式
function fixDateFormat(dateStr) {
    if (!dateStr) return dateStr;
    if (dateStr.includes('T')) {
        return dateStr.split('T')[0];
    }
    return dateStr;
}

// 格式化日期为中文
function formatDate(date) {
    const now = new Date();
    const beijingNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = new Date(beijingNow.getUTCFullYear(), beijingNow.getUTCMonth(), beijingNow.getUTCDate());
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const targetDate = new Date(date);
    const beijingTarget = new Date(targetDate.getTime() + 8 * 60 * 60 * 1000);
    const targetDay = new Date(beijingTarget.getUTCFullYear(), beijingTarget.getUTCMonth(), beijingTarget.getUTCDate());
    
    if (targetDay.getTime() === today.getTime()) return '今天';
    if (targetDay.getTime() === yesterday.getTime()) return '昨天';
    if (targetDay.getTime() === tomorrow.getTime()) return '明天';
    
    const month = targetDay.getMonth() + 1;
    const day = targetDay.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[targetDay.getDay()];
    return `${month}月${day}日(${weekday})`;
}

// 计算下次提醒日期
function calculateNextReminderDate(lastDate, intervalDays) {
    const last = new Date(lastDate);
    const next = new Date(last);
    next.setDate(next.getDate() + intervalDays);
    return next;
}

// 发送Telegram消息
function sendTelegramMessage(message) {
    return new Promise((resolve) => {
        if (!TOKEN || !CHAT_ID) {
            console.log('❌ 未配置Token或Chat ID');
            resolve(false);
            return;
        }

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
    console.log('='.repeat(50));
    console.log('🚀 Telegram定时提醒系统');
    console.log('='.repeat(50));
    
    const today = getTodayDateString();
    const todayDate = new Date(today);
    console.log(`📅 北京时间: ${today} (${formatDate(todayDate)})`);
    
    // 读取提醒数据
    let reminders = [];
    try {
        const rootFile = path.join(__dirname, '..', 'reminders.json');
        if (fs.existsSync(rootFile)) {
            reminders = JSON.parse(fs.readFileSync(rootFile, 'utf8'));
            console.log(`📖 已加载 ${reminders.length} 个提醒`);
            
            // 修复日期格式
            reminders.forEach(r => {
                if (r.nextReminder) r.nextReminder = fixDateFormat(r.nextReminder);
                if (r.lastUpdated) r.lastUpdated = fixDateFormat(r.lastUpdated);
                if (!r.nextReminder) {
                    const nextDate = calculateNextReminderDate(r.lastUpdated, r.days);
                    r.nextReminder = nextDate.toISOString().split('T')[0];
                }
                if (r.enabled === undefined) r.enabled = true;
            });
        } else {
            reminders = [
                { 
                    id: Date.now(), 
                    name: "网宿IP更新", 
                    lastUpdated: today, 
                    nextReminder: today, 
                    days: 3, 
                    enabled: true 
                }
            ];
            console.log('📝 创建默认提醒');
        }
    } catch (e) {
        console.error('❌ 读取失败:', e.message);
        reminders = [];
    }
    
    // 筛选今日到期提醒
    const dueReminders = reminders.filter(r => r.enabled !== false && r.nextReminder === today);
    console.log(`🔍 今日到期: ${dueReminders.length} 个`);
    
    // 发送提醒
    if (dueReminders.length > 0) {
        let message = `📢 <b>每日提醒 · ${formatDate(todayDate)}</b>\n\n`;
        
        dueReminders.forEach((r, index) => {
            const nextDate = calculateNextReminderDate(today, r.days);
            message += `${index + 1}. ${r.name}\n`;
            message += `   ⏰ 下次: ${formatDate(nextDate)}\n`;
            message += `   📊 间隔: ${r.days}天\n\n`;
        });
        
        const success = await sendTelegramMessage(message);
        
        if (success) {
            dueReminders.forEach(r => {
                r.lastUpdated = today;
                const nextDate = calculateNextReminderDate(today, r.days);
                r.nextReminder = nextDate.toISOString().split('T')[0];
            });
            console.log('✅ 已更新日期');
        }
    }
    
    // 保存数据
    try {
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(path.join(dataDir, 'reminders.json'), JSON.stringify(reminders, null, 2));
        fs.writeFileSync(path.join(__dirname, '..', 'reminders.json'), JSON.stringify(reminders, null, 2));
        console.log('💾 数据已保存');
    } catch (e) {
        console.error('❌ 保存失败:', e.message);
    }
    
    console.log('='.repeat(50));
    console.log('✨ 执行完成');
    console.log('='.repeat(50));
}

main().catch(console.error);
