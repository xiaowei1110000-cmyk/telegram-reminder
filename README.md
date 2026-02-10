# Telegram定时提醒系统

基于GitHub Actions的免费定时提醒系统，无需服务器，每天自动发送Telegram提醒。

## 功能特点

✅ **完全免费** - 使用GitHub免费额度  
✅ **无需服务器** - GitHub Actions作为"服务器"  
✅ **自动定时** - 每天11:00（北京时间）自动运行  
✅ **多类型支持** - 可以设置多个提醒类型  
✅ **永久运行** - 只要GitHub仓库存在就一直运行  

## 快速开始

### 1. 创建Telegram Bot
1. 在Telegram搜索 @BotFather
2. 发送 `/newbot` 命令
3. 按照提示创建Bot
4. 获取Bot Token（类似：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2. 获取Chat ID
1. 将Bot添加到你的群组
2. 在群组中发送一条消息
3. 访问：`https://api.telegram.org/bot你的BOT_TOKEN/getUpdates`
4. 查找 `chat_id` 字段

### 3. 配置GitHub Secrets
1. 进入本仓库的 Settings
2. 选择 Secrets and variables → Actions
3. 点击 New repository secret
4. 添加以下两个Secret：
   - `TELEGRAM_BOT_TOKEN`: 你的Bot Token
   - `TELEGRAM_CHAT_ID`: 你的群组Chat ID

### 4. 访问配置页面
1. 启用GitHub Pages后访问：`https://你的用户名.github.io/telegram-reminder/`
2. 添加你的提醒类型
3. 设置间隔天数（如3天）

### 5. 测试运行
1. 进入仓库的 Actions 标签页
2. 选择 "Send Telegram Reminder"
3. 点击 "Run workflow"
4. 查看运行日志

## 文件结构

- `index.html` - 配置页面
- `.github/workflows/reminder.yml` - GitHub Actions配置
- `reminders.json` - 提醒数据存储
- `send_reminder.py` - 提醒发送脚本

## 提醒格式示例
