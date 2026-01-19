import telebot
from telebot import types
import json
import os
import uuid
import requests

# ================= НАСТРОЙКИ =================
TOKEN = '8527321626:AAHGqnSLj6A0p5Rh6ccJxDoDG4dGOXbeQVk'
ADMIN_GROUP_ID = -1003629659528
DATA_FILE = 'users_data.json'
PENDING_PAYMENTS_FILE = 'pending_payments.json'
SMS_PRICE_USDT = 1  # Цена за 1 СМС в USDT
SMS_PRICE_TON = 1.63   # Цена за 1 СМС в TON
# =============================================

bot = telebot.TeleBot(TOKEN)
user_storage = {}

# Система хранения данных
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_data(data):
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_pending_payments():
    if os.path.exists(PENDING_PAYMENTS_FILE):
        with open(PENDING_PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_pending_payments(data):
    with open(PENDING_PAYMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def get_user_balance(user_id, currency='USDT'):
    data = load_data()
    user_id_str = str(user_id)
    if user_id_str in data:
        return data[user_id_str].get(f'balance_{currency}', 0)
    return 0

def update_user_balance(user_id, amount, currency='USDT', operation='add'):
    data = load_data()
    user_id_str = str(user_id)
    
    if user_id_str not in data:
        data[user_id_str] = {
            'balance_USDT': 0,
            'balance_TON': 0,
            'transactions': []
        }
    
    balance_key = f'balance_{currency}'
    
    if operation == 'add':
        data[user_id_str][balance_key] += amount
        transaction = {
            'type': 'deposit',
            'amount': amount,
            'currency': currency,
            'timestamp': 'now'
        }
    elif operation == 'subtract':
        data[user_id_str][balance_key] -= amount
        transaction = {
            'type': 'payment',
            'amount': amount,
            'currency': currency,
            'timestamp': 'now'
        }
    
    data[user_id_str]['transactions'].append(transaction)
    save_data(data)
    return data[user_id_str][balance_key]

# Генерация адресов
def get_payment_address(currency):
    if currency == "USDT":
        return "TJSgjT9n1234567890abcdefghijklmnop"
    else:  # TON
        return "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N"

def get_payment_network(currency):
    if currency == "USDT":
        return "Tron (TRC20)"
    else:  # TON
        return "The Open Network"

@bot.message_handler(commands=['start'])
def start(message):
    balance_usdt = get_user_balance(message.chat.id, 'USDT')
    balance_ton = get_user_balance(message.chat.id, 'TON')
    
    markup = types.InlineKeyboardMarkup(row_width=1)
    btn_mailing = types.InlineKeyboardButton("🚀 Запустить рассылку", callback_data='start_mailing')
    btn_profile = types.InlineKeyboardButton(f"👤 Профиль | USDT: {balance_usdt} | TON: {balance_ton}", callback_data='profile')
    btn_deposit = types.InlineKeyboardButton("💳 Пополнить баланс", callback_data='deposit_menu')
    markup.add(btn_mailing, btn_profile, btn_deposit)
    
    bot.send_message(message.chat.id, 
                     "✨ *Добро пожаловать в SMS Mailing!*\n\n"
                     "📨 Отправляйте СМС рассылки быстро и удобно.\n"
                     "💼 Идеально для бизнеса и уведомлений.\n\n"
                     "💰 *Система баланса:*\n"
                     f"• 1 СМС = {SMS_PRICE_USDT} USDT\n"
                     f"• 1 СМС = {SMS_PRICE_TON} TON\n\n"
                     "👇 *Выберите действие:*",
                     reply_markup=markup, 
                     parse_mode="Markdown")

@bot.message_handler(commands=['sms'])
def sms_command(message):
    balance_usdt = get_user_balance(message.chat.id, 'USDT')
    balance_ton = get_user_balance(message.chat.id, 'TON')
    
    if balance_usdt < SMS_PRICE_USDT and balance_ton < SMS_PRICE_TON:
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("💳 Пополнить баланс", callback_data='deposit_menu'))
        
        bot.send_message(message.chat.id,
                         f"⚠️ *Недостаточно средств*\n\n"
                         f"💰 Ваш баланс:\n"
                         f"• USDT: *{balance_usdt}*\n"
                         f"• TON: *{balance_ton}*\n\n"
                         f"💸 Требуется:\n"
                         f"• *{SMS_PRICE_USDT} USDT* за 1 СМС\n"
                         f"• *{SMS_PRICE_TON} TON* за 1 СМС\n\n"
                         f"Пожалуйста, пополните баланс для отправки СМС.",
                         reply_markup=markup,
                         parse_mode="Markdown")
        return
    
    msg = bot.send_message(message.chat.id, 
                         "📱 *ВВЕДИТЕ НОМЕРА*\n\n"
                         "📝 *Формат ввода:*\n"
                         "`+79991234567 ;`\n"
                         "`89991234567 ;`\n\n"
                         "⚠️ *Требования:*\n"
                         "• Начинаются на +7, 7 или 8\n"
                         "• Разделяются точкой с запятой\n"
                         "• Каждый номер с новой строки\n\n"
                         "📋 *Пример:*\n"
                         "```\n"
                         "+79991234567 ;\n"
                         "89991234567 ;\n"
                         "79001234567 ;\n"
                         "```",
                         parse_mode="Markdown")
    bot.register_next_step_handler(msg, process_numbers)

@bot.callback_query_handler(func=lambda call: True)
def callback_query(call):
    if call.data == "start_mailing":
        balance_usdt = get_user_balance(call.from_user.id, 'USDT')
        balance_ton = get_user_balance(call.from_user.id, 'TON')
        
        if balance_usdt < SMS_PRICE_USDT and balance_ton < SMS_PRICE_TON:
            markup = types.InlineKeyboardMarkup()
            markup.add(types.InlineKeyboardButton("💳 Пополнить баланс", callback_data='deposit_menu'))
            
            bot.send_message(call.message.chat.id,
                             f"⚠️ *Недостаточно средств*\n\n"
                             f"💰 Ваш баланс:\n"
                             f"• USDT: *{balance_usdt}*\n"
                             f"• TON: *{balance_ton}*\n\n"
                             f"💸 Требуется:\n"
                             f"• *{SMS_PRICE_USDT} USDT* за 1 СМС\n"
                             f"• *{SMS_PRICE_TON} TON* за 1 СМС\n\n"
                             f"Пожалуйста, пополните баланс для отправки СМС.",
                             reply_markup=markup,
                             parse_mode="Markdown")
            return
        
        msg = bot.send_message(call.message.chat.id, 
                             "📱 *ВВЕДИТЕ НОМЕРА*\n\n"
                             "📝 *Формат ввода:*\n"
                             "`+79991234567 ;`\n"
                             "`89991234567 ;`\n\n"
                             "⚠️ *Требования:*\n"
                             "• Начинаются на +7, 7 или 8\n"
                             "• Разделяются точкой с запятой\n"
                             "• Каждый номер с новой строки\n\n"
                             "📋 *Пример:*\n"
                             "```\n"
                             "+79991234567 ;\n"
                             "89991234567 ;\n"
                             "79001234567 ;\n"
                             "```",
                             parse_mode="Markdown")
        bot.register_next_step_handler(msg, process_numbers)
    
    elif call.data == "profile":
        balance_usdt = get_user_balance(call.from_user.id, 'USDT')
        balance_ton = get_user_balance(call.from_user.id, 'TON')
        data = load_data()
        user_data = data.get(str(call.from_user.id), {})
        transactions = user_data.get('transactions', [])
        
        transactions_text = ""
        for t in transactions[-5:]:
            if t['type'] == 'deposit':
                emoji = "📥"
                action = "Пополнение"
            else:
                emoji = "📤"
                action = "Списание"
            transactions_text += f"{emoji} {action}: {t['amount']} {t['currency']}\n"
        
        if not transactions_text:
            transactions_text = "Нет транзакций"
        
        profile_text = (
            "👤 *ВАШ ПРОФИЛЬ*\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"🆔 *ID:* `{call.from_user.id}`\n"
            f"👁 *Username:* @{call.from_user.username if call.from_user.username else 'не указан'}\n"
            f"📛 *Имя:* {call.from_user.first_name}\n\n"
            f"💰 *БАЛАНСЫ:*\n"
            f"💎 USDT: *{balance_usdt}*\n"
            f"⚡ TON: *{balance_ton}*\n\n"
            f"📊 *ПОСЛЕДНИЕ ОПЕРАЦИИ:*\n"
            f"{transactions_text}\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"💎 *Цены:*\n"
            f"• 1 СМС = {SMS_PRICE_USDT} USDT\n"
            f"• 1 СМС = {SMS_PRICE_TON} TON"
        )
        
        markup = types.InlineKeyboardMarkup(row_width=2)
        markup.add(
            types.InlineKeyboardButton("💳 Пополнить", callback_data='deposit_menu'),
            types.InlineKeyboardButton("🚀 Рассылка", callback_data='start_mailing'),
            types.InlineKeyboardButton("🔄 Обновить", callback_data='profile')
        )
        
        bot.edit_message_text(profile_text, 
                            call.message.chat.id, 
                            call.message.message_id, 
                            reply_markup=markup,
                            parse_mode="Markdown")
    
    elif call.data == "deposit_menu":
        markup = types.InlineKeyboardMarkup(row_width=2)
        markup.add(
            types.InlineKeyboardButton("💎 USDT (TRON)", callback_data='deposit_usdt'),
            types.InlineKeyboardButton("⚡ TON", callback_data='deposit_ton'),
            types.InlineKeyboardButton("🔙 Назад в профиль", callback_data='profile')
        )
        
        deposit_text = (
            "💳 *ПОПОЛНЕНИЕ БАЛАНСА*\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"💰 *Текущие балансы:*\n"
            f"• USDT: *{get_user_balance(call.from_user.id, 'USDT')}*\n"
            f"• TON: *{get_user_balance(call.from_user.id, 'TON')}*\n\n"
            "👇 *Выберите криптовалюту:*"
        )
        
        bot.edit_message_text(deposit_text,
                            call.message.chat.id,
                            call.message.message_id,
                            reply_markup=markup,
                            parse_mode="Markdown")
    
    elif call.data == "deposit_usdt":
        markup = types.InlineKeyboardMarkup(row_width=3)
        markup.add(
            types.InlineKeyboardButton("💎 10 USDT", callback_data='deposit_usdt_10'),
            types.InlineKeyboardButton("💎 25 USDT", callback_data='deposit_usdt_25'),
            types.InlineKeyboardButton("💎 50 USDT", callback_data='deposit_usdt_50'),
            types.InlineKeyboardButton("💎 100 USDT", callback_data='deposit_usdt_100'),
            types.InlineKeyboardButton("💎 250 USDT", callback_data='deposit_usdt_250'),
            types.InlineKeyboardButton("💎 Другая сумма", callback_data='deposit_usdt_custom')
        )
        markup.add(types.InlineKeyboardButton("🔙 Назад", callback_data='deposit_menu'))
        
        deposit_text = (
            "💎 *ПОПОЛНЕНИЕ USDT*\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "💰 *Выберите сумму пополнения:*\n\n"
            "Минимальная сумма: *10 USDT*\n"
            "Сеть: *TRON (TRC20)*"
        )
        
        bot.edit_message_text(deposit_text,
                            call.message.chat.id,
                            call.message.message_id,
                            reply_markup=markup,
                            parse_mode="Markdown")
    
    elif call.data == "deposit_ton":
        markup = types.InlineKeyboardMarkup(row_width=3)
        markup.add(
            types.InlineKeyboardButton("⚡ 10 TON", callback_data='deposit_ton_10'),
            types.InlineKeyboardButton("⚡ 25 TON", callback_data='deposit_ton_25'),
            types.InlineKeyboardButton("⚡ 50 TON", callback_data='deposit_ton_50'),
            types.InlineKeyboardButton("⚡ 100 TON", callback_data='deposit_ton_100'),
            types.InlineKeyboardButton("⚡ 250 TON", callback_data='deposit_ton_250'),
            types.InlineKeyboardButton("⚡ Другая сумма", callback_data='deposit_ton_custom')
        )
        markup.add(types.InlineKeyboardButton("🔙 Назад", callback_data='deposit_menu'))
        
        deposit_text = (
            "⚡ *ПОПОЛНЕНИЕ TON*\n"
            "━━━━━━━━━━━━━━━━━━\n"
            "💰 *Выберите сумму пополнения:*\n\n"
            "Минимальная сумма: *10 TON*\n"
            "Сеть: *The Open Network*"
        )
        
        bot.edit_message_text(deposit_text,
                            call.message.chat.id,
                            call.message.message_id,
                            reply_markup=markup,
                            parse_mode="Markdown")
    
    elif call.data.startswith("deposit_usdt_") or call.data.startswith("deposit_ton_"):
        if call.data.endswith("_custom"):
            currency = "USDT" if "usdt" in call.data else "TON"
            msg = bot.send_message(call.message.chat.id,
                                 f"💎 *ВВЕДИТЕ СУММУ ПОПОЛНЕНИЯ В {currency}*\n\n"
                                 f"💰 Минимальная сумма: *10 {currency}*\n\n"
                                 f"📝 Введите сумму:",
                                 parse_mode="Markdown")
            bot.register_next_step_handler(msg, process_custom_deposit, currency)
            return
        
        parts = call.data.split('_')
        currency = parts[1].upper()
        amount = float(parts[2])
        
        # Проверяем минимальную сумму
        if amount < 10:
            bot.send_message(call.message.chat.id,
                           f"❌ *Минимальная сумма 10 {currency}*",
                           parse_mode="Markdown")
            return
        
        address = get_payment_address(currency)
        network = get_payment_network(currency)
        emoji = "💎" if currency == "USDT" else "⚡"
        
        user_storage[call.from_user.id] = {
            'deposit_amount': amount,
            'deposit_currency': currency,
            'deposit_address': address
        }
        
        payment_text = (
            f"{emoji} *ПОПОЛНЕНИЕ {currency}*\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"💰 *Сумма к оплате:* {amount} {currency}\n"
            f"🌐 *Сеть:* {network}\n\n"
            f"📨 *Адрес для пополнения:*\n"
            f"`{address}`\n\n"
            f"⚠️ *Важно:*\n"
            "• Отправьте точную сумму\n"
            "• Проверьте адрес перед отправкой\n"
            "• Комиссию оплачивает отправитель\n"
            "━━━━━━━━━━━━━━━━━━"
        )
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("✅ Проверить платеж", callback_data=f"check_payment_{currency}_{amount}"))
        
        bot.send_message(call.message.chat.id, payment_text, reply_markup=markup, parse_mode="Markdown")
    
    elif call.data.startswith("check_payment_"):
        parts = call.data.split('_')
        currency = parts[2]
        amount = float(parts[3])
        
        msg = bot.send_message(call.message.chat.id,
                             f"📥 *ПРОВЕРКА ПЛАТЕЖА*\n\n"
                             f"💰 Сумма: {amount} {currency}\n\n"
                             f"🔗 *Отправьте ХЕШ (ID) транзакции:*\n"
                             f"Скопируйте хеш транзакции из вашего кошелька и отправьте его здесь.",
                             parse_mode="Markdown")
        bot.register_next_step_handler(msg, process_tx_hash, amount, currency)
    
    # Обработка веб-запросов
    elif call.data.startswith("web_ok_"):
        # Формат: web_ok_USERID_REQUESTID_PAYMENTMETHOD_PRICE
        parts = call.data.split('_')
        user_id = int(parts[2])
        request_id = parts[3]
        payment_method = parts[4]
        price = float(parts[5])
        
        # Получаем баланс пользователя
        balance = get_user_balance(user_id, payment_method.upper())
        
        if balance >= price:
            # Списание средств
            new_balance = update_user_balance(user_id, price, payment_method.upper(), 'subtract')
            
            # Уведомляем пользователя
            bot.send_message(user_id,
                           f"✅ *ВАША ЗАЯВКА ОДОБРЕНА!*\n\n"
                           f"💰 *Списано:* {price} {payment_method.upper()}\n"
                           f"💎 *Новый баланс:* {new_balance}\n"
                           f"🚀 *Рассылка запущена!*",
                           parse_mode="Markdown")
            
            # Обновляем сообщение админу
            bot.edit_message_text(f"✅ *Заявка одобрена и оплачена*\n"
                                f"👤 Пользователь: {user_id}\n"
                                f"💰 Списано: {price} {payment_method.upper()}",
                                call.message.chat.id,
                                call.message.message_id,
                                parse_mode="Markdown")
        else:
            # Уведомляем пользователя о недостатке средств
            bot.send_message(user_id,
                           f"⚠️ *НЕДОСТАТОЧНО СРЕДСТВ*\n\n"
                           f"💰 Требуется: {price} {payment_method.upper()}\n"
                           f"💎 Ваш баланс: {balance}\n\n"
                           f"Пожалуйста, пополните баланс",
                           parse_mode="Markdown")
            
            # Обновляем сообщение админу
            bot.edit_message_text(f"⚠️ *Недостаточно средств у пользователя*\n"
                                f"👤 Пользователь: {user_id}\n"
                                f"💰 Требуется: {price} {payment_method.upper()}\n"
                                f"💎 Баланс: {balance}",
                                call.message.chat.id,
                                call.message.message_id,
                                parse_mode="Markdown")
    
    elif call.data.startswith("web_no_"):
        parts = call.data.split('_')
        user_id = int(parts[2])
        request_id = parts[3]
        
        bot.send_message(user_id,
                       "❌ *ВАША ЗАЯВКА ОТКЛОНЕНА*\n"
                       "Пожалуйста, свяжитесь с поддержкой для уточнения деталей.",
                       parse_mode="Markdown")
        
        bot.edit_message_text("❌ *Заявка отклонена*",
                            call.message.chat.id,
                            call.message.message_id,
                            parse_mode="Markdown")
    
    elif call.data.startswith("pay_balance_"):
        parts = call.data.split('_')
        currency = parts[2].upper()
        uid = int(parts[3])
        
        user_data = user_storage.get(uid, {})
        nums = user_data.get('list', [])
        
        if currency == "USDT":
            amount = len(nums) * SMS_PRICE_USDT
        else:
            amount = len(nums) * SMS_PRICE_TON
        
        new_balance = update_user_balance(uid, amount, currency, 'subtract')
        
        bot.send_message(uid,
                       f"✅ *ОПЛАТА ПРОШЛА УСПЕШНО!*\n\n"
                       f"💰 *Списано:* {amount} {currency}\n"
                       f"💎 *Новый баланс {currency}:* {new_balance}\n"
                       f"📱 *Номеров для рассылки:* {len(nums)} шт\n"
                       f"🚀 *Рассылка запущена!*",
                       parse_mode="Markdown")
        
        bot.send_message(ADMIN_GROUP_ID,
                       f"✅ *РАССЫЛКА ОПЛАЧЕНА*\n"
                       f"👤 Пользователь: {uid}\n"
                       f"💰 Валюта: {currency}\n"
                       f"💸 Сумма: {amount}\n"
                       f"📱 Номеров: {len(nums)} шт")
    
    # Обработка подтверждения депозита админом
    elif call.data.startswith("confirm_deposit_"):
        deposit_id = call.data.replace("confirm_deposit_", "")
        pending_payments = load_pending_payments()
        
        if deposit_id in pending_payments:
            deposit = pending_payments[deposit_id]
            uid = deposit['user_id']
            amount = deposit['amount']
            currency = deposit['currency']
            tx_hash = deposit['tx_hash']
            
            # Зачисляем средства
            new_balance = update_user_balance(uid, amount, currency, 'add')
            
            # Уведомляем пользователя
            bot.send_message(uid,
                           f"✅ *ПЛАТЕЖ ПОДТВЕРЖДЕН!*\n\n"
                           f"💰 *Зачислено:* {amount} {currency}\n"
                           f"💎 *Новый баланс {currency}:* {new_balance}\n"
                           f"🔗 *Транзакция:* {tx_hash[:20]}...",
                           parse_mode="Markdown")
            
            # Удаляем из ожидающих
            del pending_payments[deposit_id]
            save_pending_payments(pending_payments)
            
            # Обновляем сообщение админу
            bot.edit_message_text(f"✅ *Платеж подтвержден*\n\n"
                                f"👤 Пользователь: {uid}\n"
                                f"💰 Сумма: {amount} {currency}\n"
                                f"🔗 Хеш: {tx_hash[:20]}...",
                                call.message.chat.id,
                                call.message.message_id,
                                parse_mode="Markdown")
    
    elif call.data.startswith("reject_deposit_"):
        deposit_id = call.data.replace("reject_deposit_", "")
        pending_payments = load_pending_payments()
        
        if deposit_id in pending_payments:
            deposit = pending_payments[deposit_id]
            uid = deposit['user_id']
            amount = deposit['amount']
            currency = deposit['currency']
            
            # Уведомляем пользователя
            bot.send_message(uid,
                           f"❌ *ПЛАТЕЖ ОТКЛОНЕН*\n\n"
                           f"💰 *Сумма:* {amount} {currency}\n\n"
                           f"📌 *Возможные причины:*\n"
                           f"• Неверный хеш транзакции\n"
                           f"• Транзакция не найдена\n\n"
                           f"🔄 *Попробуйте отправить заново.*",
                           parse_mode="Markdown")
            
            # Удаляем из ожидающих
            del pending_payments[deposit_id]
            save_pending_payments(pending_payments)
            
            # Обновляем сообщение админу
            bot.edit_message_text(f"❌ *Платеж отклонен*\n"
                                f"👤 Пользователь: {uid}\n"
                                f"💰 Сумма: {amount} {currency}",
                                call.message.chat.id,
                                call.message.message_id,
                                parse_mode="Markdown")

def process_custom_deposit(message, currency):
    try:
        amount = float(message.text)
        if amount < 10:
            bot.send_message(message.chat.id,
                           f"❌ *Минимальная сумма 10 {currency}*",
                           parse_mode="Markdown")
            return
        
        address = get_payment_address(currency)
        network = get_payment_network(currency)
        emoji = "💎" if currency == "USDT" else "⚡"
        
        user_storage[message.chat.id] = {
            'deposit_amount': amount,
            'deposit_currency': currency,
            'deposit_address': address
        }
        
        payment_text = (
            f"{emoji} *ПОПОЛНЕНИЕ {currency}*\n"
            "━━━━━━━━━━━━━━━━━━\n"
            f"💰 *Сумма к оплате:* {amount} {currency}\n"
            f"🌐 *Сеть:* {network}\n\n"
            f"📨 *Адрес для пополнения:*\n"
            f"`{address}`\n\n"
            f"⚠️ *Важно:*\n"
            "• Отправьте точную сумму\n"
            "• Проверьте адрес перед отправкой\n"
            "• Комиссию оплачивает отправитель\n"
            "━━━━━━━━━━━━━━━━━━"
        )
        
        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("✅ Проверить платеж", callback_data=f"check_payment_{currency}_{amount}"))
        
        bot.send_message(message.chat.id, payment_text, reply_markup=markup, parse_mode="Markdown")
        
    except:
        bot.send_message(message.chat.id,
                       "❌ *Неверный формат суммы!*\nВведите число (например: 25.5)",
                       parse_mode="Markdown")

def process_tx_hash(message, amount, currency):
    tx_hash = message.text.strip()
    
    if not tx_hash or len(tx_hash) < 10:
        bot.send_message(message.chat.id,
                       "❌ *Неверный формат хеша!*\n"
                       "Хеш транзакции должен содержать не менее 10 символов.",
                       parse_mode="Markdown")
        return
    
    # Сохраняем в ожидающие платежи
    deposit_id = f"{message.chat.id}_{tx_hash[:10]}_{uuid.uuid4().hex[:8]}"
    pending_payments = load_pending_payments()
    
    pending_payments[deposit_id] = {
        'user_id': message.chat.id,
        'username': message.from_user.username,
        'first_name': message.from_user.first_name,
        'amount': amount,
        'currency': currency,
        'tx_hash': tx_hash,
        'timestamp': 'now'
    }
    
    save_pending_payments(pending_payments)
    
    # Уведомляем пользователя
    bot.send_message(message.chat.id,
                   f"📨 *ХЕШ ОТПРАВЛЕН НА ПРОВЕРКУ*\n\n"
                   f"💰 Сумма: {amount} {currency}\n"
                   f"🔗 Хеш: `{tx_hash[:30]}...`\n\n"
                   f"⏱ *Ожидайте подтверждения администратора*\n"
                   f"Обычно это занимает 5-15 минут.",
                   parse_mode="Markdown")
    
    # Отправляем уведомление админу
    admin_text = (
        f"💸 *НОВЫЙ ПЛАТЕЖ НА ПРОВЕРКУ*\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Пользователь:*\n"
        f"🆔 ID: `{message.chat.id}`\n"
        f"👁 @{message.from_user.username if message.from_user.username else 'нет'}\n"
        f"📛 Имя: {message.from_user.first_name}\n\n"
        f"💰 *Детали платежа:*\n"
        f"💎 Сумма: {amount} {currency}\n"
        f"🔗 Хеш: `{tx_hash}`\n\n"
        f"👇 *После проверки:*\n"
        f"Добавить {amount} {currency} к балансу пользователя"
    )
    
    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("✅ Подтвердить", callback_data=f"confirm_deposit_{deposit_id}"),
        types.InlineKeyboardButton("❌ Отклонить", callback_data=f"reject_deposit_{deposit_id}")
    )
    
    bot.send_message(ADMIN_GROUP_ID, admin_text, reply_markup=markup, parse_mode="Markdown")

def process_numbers(message):
    if not message.text or ';' not in message.text:
        bot.reply_to(message,
                   "❌ *ОШИБКА ФОРМАТА*\n\n"
                   "📌 Номера должны быть разделены `;`\n\n"
                   "🔄 *Попробуйте снова:*",
                   parse_mode="Markdown")
        return
    
    raw_list = [n.strip() for n in message.text.split(';') if n.strip()]
    
    for n in raw_list:
        if not (n.startswith('+7') or n.startswith('7') or n.startswith('8')):
            bot.reply_to(message,
                       f"❌ *НЕВЕРНЫЙ НОМЕР:* `{n}`\n\n"
                       "📌 Должен начинаться на:\n"
                       "• +7\n• 7\n• 8",
                       parse_mode="Markdown")
            return

    user_storage[message.chat.id] = {'list': raw_list}
    
    total_usdt = len(raw_list) * SMS_PRICE_USDT
    total_ton = len(raw_list) * SMS_PRICE_TON
    
    success_text = (
        f"✅ *НОМЕРА ПРИНЯТЫ*\n"
        f"━━━━━━━━━━━━━━━━\n"
        f"📊 *Статистика:*\n"
        f"• Получено: {len(raw_list)} номеров\n\n"
        f"💰 *Стоимость рассылки:*\n"
        f"• {total_usdt} USDT\n"
        f"• {total_ton} TON\n\n"
        f"📝 *Теперь отправьте текст СМС:*"
    )
    
    msg = bot.send_message(message.chat.id, success_text, parse_mode="Markdown")
    bot.register_next_step_handler(msg, process_sms_text)

def process_sms_text(message):
    if not message.text: 
        return
    
    uid = message.chat.id
    txt = message.text
    nums = user_storage.get(uid, {}).get('list', [])

    formatted_numbers = ""
    for i, n in enumerate(nums[:5], 1):
        formatted_numbers += f"{i}. `{n}`\n"
    
    if len(nums) > 5:
        formatted_numbers += f"...и еще {len(nums) - 5} номеров\n"

    total_usdt = len(nums) * SMS_PRICE_USDT
    total_ton = len(nums) * SMS_PRICE_TON
    
    report = (
        f"📩 *НОВАЯ ЗАЯВКА НА РАССЫЛКУ*\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"👤 *Пользователь:*\n"
        f"🆔 ID: `{uid}`\n"
        f"📛 Имя: {message.from_user.first_name}\n\n"
        f"📊 *Статистика:*\n"
        f"📱 Номеров: {len(nums)} шт\n"
        f"💰 Стоимость: {total_usdt} USDT / {total_ton} TON\n\n"
        f"📋 *НОМЕРА:*\n"
        f"```\n{formatted_numbers}```\n"
        f"💬 *ТЕКСТ СМС:*\n"
        f"```\n{txt[:300]}{'...' if len(txt) > 300 else ''}```"
    )

    markup = types.InlineKeyboardMarkup(row_width=2)
    markup.add(
        types.InlineKeyboardButton("✅ Подтвердить", callback_data=f"adm_ok_{uid}"),
        types.InlineKeyboardButton("❌ Отклонить", callback_data=f"adm_no_{uid}")
    )

    try:
        bot.send_message(ADMIN_GROUP_ID, report, parse_mode="Markdown", reply_markup=markup)
        
        user_msg = (
            f"⏳ *ЗАЯВКА ОТПРАВЛЕНА НА МОДЕРАЦИЮ*\n\n"
            f"📊 *Ваши данные:*\n"
            f"• Номеров: {len(nums)} шт\n"
            f"• Стоимость: {total_usdt} USDT / {total_ton} TON\n\n"
            f"⏱ *Обычно проверка занимает 2-5 минут*"
        )
        
        bot.send_message(uid, user_msg, parse_mode="Markdown")
    except Exception as e:
        bot.send_message(uid,
                       "❌ *ОШИБКА ОТПРАВКИ*",
                       parse_mode="Markdown")
        print(f"Error: {e}")

print("🤖 Бот запущен...")
bot.polling(none_stop=True)