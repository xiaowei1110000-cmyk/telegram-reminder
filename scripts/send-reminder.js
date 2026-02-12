/**
 * ========================================================
 * GitHub定时提醒系统 - 核心提醒脚本 v2.0
 * 功能：读取reminders.json，检查今日到期项目，发送Telegram提醒
 * 环境：Node.js 18+ / GitHub Actions
 * 作者：xiaowei1110000-cmyk
 * ========================================================
 */

// ==================== 模块导入 ====================
const fs = require('fs');
const path = require('path');
const https = require('https');

// 动态导入node-fetch（兼容CommonJS）
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    console.log('⚠️ node-fetch未安装，使用内置https模块');
}

// ==================== 常量定义 ====================
const CONFIG = {
    // 文件路径
    PATHS: {
        REMINDERS_FILE: path.join(process.cwd(), 'reminders.json'),
        BACKUP_DIR: path.join(process.cwd(), 'backups')
    },
    
    // 日期格式
    DATE_FORMAT: {
        YEAR: 'numeric',
        MONTH: '2-digit',
        DAY: '2-digit'
    },
    
    // Telegram消息限制
    TELEGRAM: {
        MAX_MESSAGE_LENGTH: 4096,
        PARSE_MODE: 'Markdown'
    },
    
    // 提醒状态颜色
    COLORS: {
        RESET: '\x1b[0m',
        RED: '\x1b[31m',
        GREEN: '\x1b[32m',
        YELLOW: '\x1b[33m',
        BLUE: '\x1b[34m',
        CYAN: '\x1b[36m'
    }
};

// ==================== 日志工具 ====================
const logger = {
    info: (...args) => console.log(`📌 ${args.join(' ')}`),
    success: (...args) => console.log(`✅ ${args.join(' ')}`),
    warn: (...args) => console.log(`⚠️ ${args.join(' ')}`),
    error: (...args) => console.log(`❌ ${args.join(' ')}`),
    debug: (...args) => console.log(`🔍 ${args.join(' ')}`),
    
    // 带颜色的输出
    color: (color, ...args) => {
        if (CONFIG.COLORS[color]) {
            console.log(CONFIG.COLORS[color], ...args, CONFIG.COLORS.RESET);
        } else {
            console.log(...args);
        }
    },
    
    separator: () => console.log('='.repeat(60))
};

// ==================== 日期工具 ====================
const dateUtils = {
    /**
     * 获取当前北京时间
     * @returns {Date} 北京时间对象
     */
    getBeijingTime: () => {
        const now = new Date();
        now.setHours(now.getHours() + 8); // UTC+8
        return now;
    },

    /**
     * 获取今天的日期字符串
     * @returns {string} YYYY-MM-DD
     */
    getTodayString: () => {
        const now = dateUtils.getBeijingTime();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 计算下次提醒日期
     * @param {string} lastDate - 最后更新日期 YYYY-MM-DD
     * @param {number} interval - 间隔天数
     * @returns {string} 下次提醒日期 YYYY-MM-DD
     */
    calculateNextDate: (lastDate, interval) => {
        const last = new Date(lastDate);
        const next = new Date(last);
        next.setDate(next.getDate() + interval);
        
        const year = next.getFullYear();
        const month = String(next.getMonth() + 1).padStart(2, '0');
        const day = String(next.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * 格式化日期显示
     * @param {string} dateStr - 日期字符串
     * @returns {string} 友好的显示格式
     */
    formatForDisplay: (dateStr) => {
        const date = new Date(dateStr);
        const today = dateUtils.getTodayString();
        
        if (dateStr === today) return '今天';
        
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[date.getDay()];
        
        return `${month}月${day}日 ${weekday}`;
    },

    /**
     * 计算两个日期之间的天数差
     * @param {string} date1 - 日期1
     * @param {string} date2 - 日期2
     * @returns {number} 天数差
     */
    daysBetween: (date1, date2) => {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        const diffTime = Math.abs(d2 - d1);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
};

// ==================== 数据操作 ====================
const dataManager = {
    /**
     * 加载提醒数据
     * @returns {Array} 提醒数据数组
     */
    load: () => {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(CONFIG.PATHS.REMINDERS_FILE)) {
                logger.warn('reminders.json 不存在，创建空文件');
                dataManager.save([]);
                return [];
            }

            // 读取文件
            const content = fs.readFileSync(CONFIG.PATHS.REMINDERS_FILE, 'utf8');
            
            // 空文件处理
            if (!content || !content.trim()) {
                logger.warn('reminders.json 是空文件');
                return [];
            }

            // 解析JSON
            const data = JSON.parse(content);
            
            // 验证数据格式
            if (!Array.isArray(data)) {
                logger.error('reminders.json 格式错误：不是数组');
                return [];
            }

            logger.success(`成功加载 ${data.length} 个提醒项目`);
            return data;

        } catch (error) {
            logger.error('加载提醒数据失败:', error.message);
            return [];
        }
    },

    /**
     * 保存提醒数据
     * @param {Array} reminders - 提醒数据
     * @returns {boolean} 是否成功
     */
    save: (reminders) => {
        try {
            // 创建备份目录
            if (!fs.existsSync(CONFIG.PATHS.BACKUP_DIR)) {
                fs.mkdirSync(CONFIG.PATHS.BACKUP_DIR, { recursive: true });
            }

            // 创建备份（每天一次）
            const today = dateUtils.getTodayString();
            const backupPath = path.join(CONFIG.PATHS.BACKUP_DIR, `reminders-${today}.json`);
            
            if (!fs.existsSync(backupPath) && fs.existsSync(CONFIG.PATHS.REMINDERS_FILE)) {
                fs.copyFileSync(CONFIG.PATHS.REMINDERS_FILE, backupPath);
                logger.info(`已创建备份: reminders-${today}.json`);
            }

            // 保存新数据
            fs.writeFileSync(
                CONFIG.PATHS.REMINDERS_FILE,
                JSON.stringify(reminders, null, 2),
                'utf8'
            );
            
            logger.success('数据保存成功');
            return true;

        } catch (error) {
            logger.error('保存提醒数据失败:', error.message);
            return false;
        }
    },

    /**
     * 验证提醒对象
     * @param {Object} reminder - 提醒对象
     * @returns {boolean} 是否有效
     */
    validate: (reminder) => {
        const required = ['id', 'name', 'lastUpdated', 'nextReminder', 'days'];
        
        for (const field of required) {
            if (!reminder[field]) {
                logger.warn(`提醒项目缺少字段: ${field}`, reminder.id);
                return false;
            }
        }

        if (reminder.days < 1) {
            logger.warn(`提醒间隔无效: ${reminder.days}`, reminder.id);
            return false;
        }

        return true;
    },

    /**
     * 更新提醒状态
     * @param {Array} reminders - 所有提醒
     * @param {Array} dueReminders - 到期的提醒
     * @returns {Array} 更新后的提醒
     */
    updateDueReminders: (reminders, dueReminders) => {
        const today = dateUtils.getTodayString();
        let updatedCount = 0;

        dueReminders.forEach(due => {
            const index = reminders.findIndex(r => r.id === due.id);
            if (index !== -1) {
                // 更新最后更新日期
                reminders[index].lastUpdated = today;
                
                // 计算下次提醒日期
                reminders[index].nextReminder = dateUtils.calculateNextDate(today, reminders[index].days);
                
                // 标记为已提醒
                reminders[index].notified = true;
                reminders[index].lastNotified = new Date().toISOString();
                
                updatedCount++;
            }
        });

        logger.success(`已更新 ${updatedCount} 个提醒的状态`);
        return reminders;
    }
};

// ==================== Telegram消息 ====================
const telegramService = {
    /**
     * 格式化提醒消息
     * @param {Array} reminders - 到期的提醒列表
     * @returns {string} 格式化后的消息
     */
    formatMessage: (reminders) => {
        const repo = process.env.GITHUB_REPOSITORY || 'xiaowei1110000-cmyk/telegram-reminder';
        const today = dateUtils.getTodayString();
        
        // 消息头部
        let message = [];
        message.push('🔔 *GitHub 定时提醒系统*');
        message.push('═══════════════════════');
        message.push('');
        message.push(`📅 日期：${today}`);
        message.push(`⏰ 时间：${new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
        message.push('');
        message.push(`*今日需要处理的项目（共 ${reminders.length} 个）：*`);
        message.push('');

        // 每个提醒项目
        reminders.forEach((item, index) => {
            const nextDate = dateUtils.calculateNextDate(today, item.days);
            
            message.push(`${index + 1}. *${item.name}*`);
            message.push(`   • 最后更新：${dateUtils.formatForDisplay(item.lastUpdated)}`);
            message.push(`   • 下次提醒：${dateUtils.formatForDisplay(nextDate)}`);
            message.push(`   • 提醒周期：每 ${item.days} 天`);
            message.push('');
        });

        // 消息尾部
        message.push('═══════════════════════');
        message.push(`[🔗 查看完整列表](https://github.com/${repo})`);
        message.push(`[⚙️ 管理提醒](https://${repo}.github.io)`);

        return message.join('\n');
    },

    /**
     * 发送Telegram消息
     * @param {string} message - 消息内容
     * @returns {Promise<boolean>} 是否成功
     */
    send: async (message) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        // 验证配置
        if (!token) {
            logger.error('TELEGRAM_BOT_TOKEN 未配置');
            return false;
        }

        if (!chatId) {
            logger.error('TELEGRAM_CHAT_ID 未配置');
            return false;
        }

        // 检查消息长度
        if (message.length > CONFIG.TELEGRAM.MAX_MESSAGE_LENGTH) {
            logger.warn(`消息过长 (${message.length} 字符)，将被截断`);
            message = message.substring(0, CONFIG.TELEGRAM.MAX_MESSAGE_LENGTH - 100) + '...\n\n消息已截断，请查看完整列表';
        }

        try {
            logger.info('正在发送Telegram消息...');

            // 优先使用node-fetch
            if (fetch) {
                const url = `https://api.telegram.org/bot${token}/sendMessage`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: message,
                        parse_mode: CONFIG.TELEGRAM.PARSE_MODE,
                        disable_web_page_preview: true
                    })
                });

                const data = await response.json();
                
                if (data.ok) {
                    logger.success(`Telegram消息发送成功`);
                    return true;
                } else {
                    logger.error('Telegram API错误:', data.description);
                    return false;
                }
            } 
            // 备用：使用https模块
            else {
                return await telegramService.sendWithHttps(token, chatId, message);
            }

        } catch (error) {
            logger.error('发送Telegram消息失败:', error.message);
            return false;
        }
    },

    /**
     * 使用内置https模块发送（备用方案）
     */
    sendWithHttps: (token, chatId, message) => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: CONFIG.TELEGRAM.PARSE_MODE,
                disable_web_page_preview: true
            });

            const options = {
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.ok);
                    } catch (e) {
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                logger.error('HTTPS请求失败:', error.message);
                resolve(false);
            });

            req.write(postData);
            req.end();
        });
    },

    /**
     * 测试Telegram Bot连接
     */
    testConnection: async () => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return false;

        try {
            const url = `https://api.telegram.org/bot${token}/getMe`;
            const response = await fetch(url);
            const data = await response.json();
            return data.ok;
        } catch (error) {
            return false;
        }
    }
};

// ==================== 主程序 ====================
class ReminderSystem {
    constructor() {
        this.reminders = [];
        this.today = dateUtils.getTodayString();
        this.stats = {
            total: 0,
            due: 0,
            sent: 0,
            updated: 0
        };
    }

    /**
     * 初始化系统
     */
    async initialize() {
        logger.separator();
        logger.color('CYAN', '🚀 GitHub定时提醒系统 v2.0');
        logger.color('CYAN', '作者: xiaowei1110000-cmyk');
        logger.separator();
        
        // 显示系统信息
        logger.info(`北京时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
        logger.info(`今日日期: ${this.today}`);
        logger.info(`Node版本: ${process.version}`);
        
        // 测试Telegram连接
        if (await telegramService.testConnection()) {
            logger.success('Telegram Bot 连接正常');
        } else {
            logger.warn('Telegram Bot 未配置或连接失败');
        }
        
        logger.separator();
    }

    /**
     * 加载数据
     */
    loadData() {
        this.reminders = dataManager.load();
        this.stats.total = this.reminders.length;
        logger.info(`当前总提醒数: ${this.stats.total} 个`);
    }

    /**
     * 检查到期提醒
     */
    checkDueReminders() {
        // 过滤出今日需要提醒的项目
        this.dueReminders = this.reminders.filter(item => {
            // 必须满足：启用 + 今日到期 + 未提醒
            return item.enabled !== false && 
                   item.nextReminder === this.today && 
                   !item.notified;
        });

        this.stats.due = this.dueReminders.length;
        
        if (this.stats.due > 0) {
            logger.success(`今日需要提醒: ${this.stats.due} 个`);
            
            // 显示具体项目
            this.dueReminders.forEach((item, i) => {
                console.log(`   ${i + 1}. ${item.name} - 上次更新: ${item.lastUpdated}`);
            });
        } else {
            logger.info('今日没有需要提醒的项目');
        }
    }

    /**
     * 发送提醒
     */
    async sendReminders() {
        if (this.stats.due === 0) {
            return;
        }

        // 格式化消息
        const message = telegramService.formatMessage(this.dueReminders);
        
        // 预览消息
        logger.debug('消息预览:');
        console.log(message.split('\n').slice(0, 5).join('\n') + '...');
        
        // 发送消息
        const sent = await telegramService.send(message);
        
        if (sent) {
            this.stats.sent = this.stats.due;
            logger.success(`已成功发送 ${this.stats.sent} 个提醒`);
        } else {
            logger.error('提醒发送失败');
        }
    }

    /**
     * 更新数据
     */
    updateData() {
        if (this.stats.sent > 0) {
            this.reminders = dataManager.updateDueReminders(this.reminders, this.dueReminders);
            this.stats.updated = this.stats.sent;
            
            if (dataManager.save(this.reminders)) {
                logger.success('数据已保存到文件');
            }
        }
    }

    /**
     * 显示统计报告
     */
    showReport() {
        logger.separator();
        logger.color('GREEN', '📊 执行报告');
        logger.separator();
        
        console.log(`总提醒数量: ${this.stats.total} 个`);
        console.log(`今日到期: ${this.stats.due} 个`);
        console.log(`成功发送: ${this.stats.sent} 个`);
        console.log(`状态更新: ${this.stats.updated} 个`);
        
        // 下次运行时间
        const tomorrow = new Date(this.today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(11, 0, 0, 0);
        
        console.log(`下次运行: ${tomorrow.toLocaleString('zh-CN', { 
            timeZone: 'Asia/Shanghai',
            hour12: false 
        })}`);
        
        logger.separator();
        logger.color('GREEN', '✨ 任务执行完成');
        logger.separator();
    }

    /**
     * 运行主流程
     */
    async run() {
        try {
            await this.initialize();
            this.loadData();
            this.checkDueReminders();
            await this.sendReminders();
            this.updateData();
            this.showReport();
            
            return {
                success: true,
                stats: this.stats
            };
            
        } catch (error) {
            logger.error('系统运行失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// ==================== 程序入口 ====================
if (require.main === module) {
    const system = new ReminderSystem();
    system.run().catch(error => {
        logger.error('未捕获的错误:', error);
        process.exit(1);
    });
}

// 导出模块
module.exports = { ReminderSystem, dateUtils, dataManager, telegramService, logger };
