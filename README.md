# ⏰ Telegram定时提醒系统

<div align="center">

![版本](https://img.shields.io/badge/版本-2.0.0-blue)
![自动化](https://img.shields.io/badge/自动化-GitHub_Actions-green)
![频率](https://img.shields.io/badge/频率-每3分钟-orange)
![状态](https://img.shields.io/badge/状态-运行中-success)

</div>

## 📋 系统概述

这是一个**完全自动化**的提醒系统，部署在GitHub云端，**无需任何服务器**，**永不间断**。

### ✨ 核心特性

| 特性 | 说明 |
|------|------|
| ⏰ **定时运行** | 每3分钟自动执行一次，北京时间 |
| 📱 **Telegram推送** | 到期自动发送消息到手机 |
| 🔄 **持续提醒** | 项目到期后每3分钟提醒一次，直到处理完成 |
| 📊 **云端存储** | 所有数据保存在GitHub仓库 |
| 🌐 **网页管理** | 随时随地添加/编辑提醒 |
| 🚀 **零成本** | 完全免费，无需服务器 |

---

## 🚀 快速开始

### 第一步：配置Telegram Bot

1. 打开Telegram，搜索 [@BotFather](https://t.me/botfather)
2. 发送 `/newbot` 创建新机器人
3. 输入机器人名称（如：`我的提醒机器人`）
4. 输入机器人用户名（必须以 `_bot` 结尾，如：`my_reminder_bot`）
5. **复制得到的Token**（格式：`1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 第二步：获取Chat ID

1. 搜索 [@userinfobot](https://t.me/userinfobot)
2. 发送 `/start`
3. **复制你的ID**（纯数字，如：`123456789`）

### 第三步：激活Bot

1. 搜索你的机器人用户名（如：`@my_reminder_bot`）
2. 点击 **Start** 按钮
3. 发送任意消息

### 第四步：配置GitHub Secrets

1. 进入仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. 添加两个Secret：

| Name | Value | 说明 |
|------|-------|------|
| `TELEGRAM_BOT_TOKEN` | 你的Bot Token | 从@BotFather获取 |
| `TELEGRAM_CHAT_ID` | 你的Chat ID | 从@userinfobot获取 |

### 第五步：开启GitHub Pages（可选）

1. 仓库 → **Settings** → **Pages**
2. Branch: `main` → `/ (root)` → **Save**
3. 等待3分钟，访问：`https://你的用户名.github.io/telegram-reminder`

---

## 📊 系统架构
