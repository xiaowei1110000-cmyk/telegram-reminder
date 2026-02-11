#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Telegram定时提醒脚本
GitHub Actions自动运行，每天发送提醒
"""

import os
import json
import requests
from datetime import datetime, timedelta

def log(message):
    """记录日志"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] {message}")

def load_reminders():
    """加载提醒数据"""
    try:
        if os.path.exists('reminders.json'):
            with open('reminders.json', 'r', encoding='utf-8') as f:
                data = json.load(f)
                log(f"成功加载 {len(data)} 个提醒项目")
                return data
        else:
            # 如果文件不存在，创建示例数据
            log("reminders.json 文件不存在，创建示例数据")
            example_data = [
                {
                    "id": 1,
                    "name": "示例提醒",
                    "lastUpdated": datetime.now().strftime('%Y-%m-%d'),
                    "days": 3,
                    "createdAt": datetime.now().isoformat()
                }
            ]
            save_reminders(example_data)
            return example_data
    except json.JSONDecodeError as e:
        log(f"reminders.json 格式错误: {e}")
        return []
    except Exception as e:
        log(f"加载提醒数据失败: {e}")
        return []

def save_reminders(reminders):
    """保存提醒数据"""
    try:
        with open('reminders.json', 'w', encoding='utf-8') as f:
            json.dump(reminders, f, ensure_ascii=False, indent=2)
        log(f"成功保存 {len(reminders)} 个提醒项目")
    except Exception as e:
        log(f"保存提醒数据失败: {e}")

def send_telegram_message(bot_token, chat_id, message):
    """发送消息到Telegram"""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'HTML'
    }
    
    try:
        log(f"正在发送消息到Telegram...")
        response = requests.post(url, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                log("✅ 消息发送成功")
                return True
            else:
                log(f"❌ Telegram API返回错误: {result.get('description')}")
                return False
        else:
            log(f"❌ HTTP错误: {response.status_code}")
            log(f"响应内容: {response.text}")
            return False
    except requests.exceptions.Timeout:
        log("❌ 请求超时")
        return False
    except Exception as e:
        log(f"❌ 发送失败: {e}")
        return False

def check_reminders(reminders):
    """检查需要发送的提醒"""
    today = datetime.now().strftime('%Y-%m-%d')
    today_zh = datetime.now().strftime('%Y年%m月%d日')
    
    log(f"开始检查提醒，今天日期: {today_zh}")
    
    messages = []
    updated_reminders = []
    need_remind_count = 0
    
    for reminder in reminders:
        try:
            name = reminder.get('name', '未命名')
            last_updated = reminder.get('lastUpdated', today)
            days = int(reminder.get('days', 3))
            
            # 计算下次提醒日期
            last_date = datetime.strptime(last_updated, '%Y-%m-%d')
            next_date = last_date + timedelta(days=days)
            next_date_str = next_date.strftime('%Y-%m-%d')
            
            log(f"检查项目: {name}")
            log(f"  上次更新: {last_updated}")
            log(f"  间隔天数: {days}天")
            log(f"  下次提醒: {next_date_str}")
            
            # 如果今天需要提醒
            if next_date_str <= today:
                message = (
                    f"🔔 提醒：今日需要更新 {name}\n"
                    f"📅 上次更新时间：{last_updated}\n"
                    f"⏰ 提醒间隔：每{days}天"
                )
                messages.append(message)
                need_remind_count += 1
                
                # 更新最后提醒时间为今天
                reminder['lastUpdated'] = today
                log(f"  ✅ 需要提醒，已更新最后提醒时间")
            else:
                # 计算还有几天
                days_left = (next_date - datetime.now()).days
                log(f"  📅 还有 {days_left} 天提醒")
            
            updated_reminders.append(reminder)
            
        except Exception as e:
            log(f"处理提醒 '{reminder.get('name', '未知')}' 时出错: {e}")
            updated_reminders.append(reminder)
    
    log(f"检查完成，共发现 {need_remind_count} 个需要提醒的项目")
    return messages, updated_reminders

def main():
    """主函数"""
    log("========== Telegram定时提醒系统开始运行 ==========")
    
    # 从环境变量获取配置
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    chat_id = os.environ.get('TELEGRAM_CHAT_ID')
    
    if not bot_token:
        log("❌ 错误：未设置 TELEGRAM_BOT_TOKEN 环境变量")
        log("请在 GitHub Repository Settings → Secrets and variables → Actions 中添加")
        return
    
    if not chat_id:
        log("❌ 错误：未设置 TELEGRAM_CHAT_ID 环境变量")
        log("请在 GitHub Repository Settings → Secrets and variables → Actions 中添加")
        return
    
    log(f"✅ Bot Token: {bot_token[:10]}...")
    log(f"✅ Chat ID: {chat_id}")
    
    # 加载提醒数据
    reminders = load_reminders()
    
    if not reminders:
        log("ℹ️ 没有配置提醒项目")
        message = (
            "ℹ️ <b>Telegram提醒系统</b>\n"
            "当前没有配置任何提醒项目\n"
            "请访问配置页面添加提醒"
        )
        send_telegram_message(bot_token, chat_id, message)
        return
    
    log(f"共有 {len(reminders)} 个提醒项目")
    
    # 检查提醒
    messages, updated_reminders = check_reminders(reminders)
    
    # 发送提醒
    if messages:
        log(f"准备发送 {len(messages)} 个提醒")
        
        # 合并所有提醒为一条消息
        combined_message = "📢 <b>今日更新提醒</b>\n\n"
        
        for i, msg in enumerate(messages, 1):
            combined_message += f"{i}. {msg}\n\n"
        
        # 添加时间信息
        current_time = datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')
        combined_message += f"⏰ 提醒时间：{current_time}"
        
        # 发送到Telegram
        success = send_telegram_message(bot_token, chat_id, combined_message)
        
        if success:
            log("✅ 提醒发送成功")
            # 保存更新后的提醒数据
            save_reminders(updated_reminders)
            log("✅ 提醒数据已保存")
        else:
            log("❌ 提醒发送失败，不更新数据文件")
    else:
        log("✅ 今天没有需要发送的提醒")
        
        # 发送状态消息
        status_message = (
            f"✅ <b>今日提醒检查完成</b>\n"
            f"📅 检查日期：{datetime.now().strftime('%Y年%m月%d日')}\n"
            f"📊 总提醒项目：{len(reminders)}个\n"
            f"🔔 今日需要提醒：0个\n\n"
            f"⏰ 下次检查：明天11:00（北京时间）"
        )
        send_telegram_message(bot_token, chat_id, status_message)
    
    log("========== 提醒系统运行完成 ==========")

if __name__ == '__main__':
    main()
