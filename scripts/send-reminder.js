const https = require('https');
const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================
const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ==================== 精美UI组件 ====================

const UI = {
    // 分隔线
    line: '⎯'.repeat(28),
    doubleLine: '═'.repeat(28),
    dotLine: '⋯'.repeat(14),
    
    // 图标
    icons: {
        reminder: '🔔',
        calendar: '📅',
        clock: '⏰',
        update: '🔄',
        interval: '📊',
        success: '✅',
        warning: '⚠️',
        error: '❌',
        heart: '💓',
        tag: '🏷️',
        next: '⏩',
        list: '📋',
        time: '⏱️'
    },
    
    // 颜色（Telegram支持的颜色标签）
    colors: {
        red: '<span class="tg-red">',
        green: '<span class="tg-green">',
        blue: '<span class="tg-blue">',
        yellow: '<span class="tg-yellow">',
        orange: '<span class="tg-orange">',
        purple: '<span class="tg-purple">',
        end: '</span>'
    }
};

// ==================== 时间处理 ====================

/**
 * 获取北京时间
 */
function getBeijingTime() {
    const now = new Date();
    return new Date(now.getTime() + 8 * 60 * 60 * 1000);
}

/**
 * 获取今天的日期字符串（YYYY-MM-DD）
 */
function getTodayString() {
    const beijing = getBeijingTime();
    const year = beijing.getUTCFullYear();
    const month = String(beijing.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijing.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 修复日期格式（去掉时间部分）
 */
function fixDate(dateStr) {
    if (!dateStr) return dateStr;
    return dateStr.split('T')[0];
}

/**
 * 智能日期格式化（终极版）
 */
function smartDateFormat(dateInput) {
    const beijingNow = getBeijingTime();
    const today = new Date(beijingNow.getUTCFullYear(), beijingNow.getUTCMonth(), beijingNow.getUTCDate());
    
    let date;
    if (typeof dateInput === 'string') {
        // 修复带时间的日期
        const cleanDate = dateInput.split('T')[0];
        date = new Date(cleanDate);
    } else {
        date = new Date(dateInput);
    }
    
    // 转换为北京时间日期
    const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const targetDay = new Date(beijingDate.getUTCFullYear(), beijingDate.getUTCMonth(), beijingDate.getUTCDate());
    
    // 计算天数差
    const diffTime = targetDay - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    // 智能格式化
    if (diffDays === 0) return '🔴 今天';
    if (diffDays === 1) return '🟡 明天';
    if (diffDays === 2) return '🟢 后天';
    if (diffDays === -1) return '⚪ 昨天';
    if (diffDays === -2) return '⚪ 前天';
    
    // 本周内
    if (diffDays > 0 && diffDays < 7) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `📌 ${weekdays[targetDay.getDay()]}`;
    }
    
    // 超过一周
    const month = targetDay.getMonth() + 1;
    const day = targetDay.getDate();
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][targetDay.getDay()];
    return `📅 ${month}月${day}日(周${weekday})`;
}

/**
 * 计算下次提醒日期
 */
function getNextDate(lastDate, days) {
    const date = new Date(lastDate.split('T')[0]);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 获取相对时间描述
 */
function getRelativeTimeDesc(dateStr) {
    const today = getTodayString();
    const nextDate = dateStr.split('T')[0];
    
    if (nextDate === today) return '⚠️ 今日到期';
    
    const date = new Date(nextDate);
    const todayDate = new Date(today);
    const diffDays = Math.round((date - todayDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '⏰ 明天';
    if (diffDays === 2) return '⏳ 后天';
    if (diffDays < 7) return `📆 ${diffDays}天后`;
    if (diffDays < 30) return `🗓️ ${Math.floor(diffDays / 7)}周后`;
    return `📅 ${Math.floor(diffDays / 30)}个月后`;
}

// ==================== Telegram消息发送 ====================

/**
 * 发送Telegram消息（专业排版）
 */
async function sendTelegramMessage(title, items, type = 'reminder') {
    if (!TOKEN || !CHAT_ID) {
        console.error('❌ 未配置Telegram');
        return false;
    }

    // ========== 构建精美消息 ==========
    let message = '';
    
    // 头部装饰
    message += `╔${UI.doubleLine}╗\n`;
    message += `║  ${UI.icons[type]} <b>${title}</b>\n`;
    message += `╚${UI.doubleLine}╝\n\n`;
    
    if (type === 'reminder' && items.length > 0) {
        // 今日提醒列表
        items.forEach((item, index) => {
            // 项目卡片
            message += `┌─[ <b>#${index + 1} ${item.name}</b> ]\n`;
            message += `│  ${UI.icons.calendar} 上次更新 · ${smartDateFormat(item.lastUpdated)}\n`;
            message += `│  ${UI.icons.clock} 提醒时间 · ${smartDateFormat(item.nextReminder)}\n`;
            message += `│  ${UI.icons.interval} 间隔周期 · ${item.days}天\n`;
            message += `│  ${UI.icons.next} 下次提醒 · ${smartDateFormat(getNextDate(item.lastUpdated, item.days))}\n`;
            message += `│  ${UI.icons.time} 剩余时间 · ${getRelativeTimeDesc(item.nextReminder)}\n`;
            message += `└${UI.dotLine}┘\n\n`;
        });
        
        // 底部统计
        message += `📊 <b>今日概览</b>\n`;
        message += `├─ 到期项目: ${items.length} 个\n`;
        message += `├─ 下次高峰: ${smartDateFormat(getNextDate(items[0]?.lastUpdated || getTodayString(), 1))}\n`;
        message += `└─ 系统状态: 🟢 运行中\n\n`;
        
    } else if (type === 'heartbeat') {
        // 心跳消息
        message += `💓 <b>系统心跳报告</b>\n\n`;
        message += `🟢 状态: 运行正常\n`;
        message += `📅 时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
        message += `📋 提醒总数: ${items.length} 个\n`;
        message += `✅ 今日到期: 0 个\n`;
        message += `⏰ 下次检查: 明天 11:00\n\n`;
    }
    
    // 公共底部
    message += `⚡️ <i>发送时间 ${new Date().toLocaleString('zh-CN', { 
        timeZone: 'Asia/Shanghai',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })}</i>`;

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
    console.log('\n' + '='.repeat(60));
    console.log('  🤖 Telegram定时提醒系统 v2.0 (专业版)');
    console.log('='.repeat(60));
    
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
            console.log('  📝 创建默认提醒');
        }
    } catch (e) {
        console.error('  ❌ 读取失败:', e.message);
        reminders = [];
    }
    
    // 2. 筛选今日到期
    const dueReminders = reminders.filter(r => r.enabled && r.nextReminder === today);
    console.log(`  🔍 今日到期: ${dueReminders.length} 个\n`);
    
    // 3. 发送消息
    let sendSuccess = false;
    
    if (dueReminders.length > 0) {
        // 发送今日提醒
        sendSuccess = await sendTelegramMessage(
            `每日提醒 · ${smartDateFormat(today)}`,
            dueReminders,
            'reminder'
        );
        
        if (sendSuccess) {
            // 更新日期
            dueReminders.forEach(r => {
                r.lastUpdated = today;
                r.nextReminder = getNextDate(today, r.days);
                r.lastNotified = new Date().toISOString();
            });
            console.log('  ✅ 已更新下次提醒日期\n');
        }
    } else {
        // 发送心跳（每天一次，但只在有更新时发）
        const lastHeartbeat = reminders[0]?.lastHeartbeat || '';
        const shouldSend = !lastHeartbeat || 
            (new Date(today) - new Date(lastHeartbeat)) / (1000 * 60 * 60 * 24) >= 1;
        
        if (shouldSend) {
            sendSuccess = await sendTelegramMessage(
                `系统心跳 · ${smartDateFormat(today)}`,
                reminders,
                'heartbeat'
            );
            if (sendSuccess && reminders[0]) {
                reminders[0].lastHeartbeat = today;
            }
        }
    }
    
    // 4. 保存数据
    try {
        // 确保所有日期都是纯格式
        reminders.forEach(r => {
            if (r.nextReminder) r.nextReminder = fixDate(r.nextReminder);
            if (r.lastUpdated) r.lastUpdated = fixDate(r.lastUpdated);
        });
        
        // 保存到data目录
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
    
    console.log('='.repeat(60));
    console.log('  ✨ 执行完成');
    console.log('='.repeat(60) + '\n');
}

// 启动
main().catch(error => {
    console.error('\n❌ 程序异常:', error);
    process.exit(1);
});
