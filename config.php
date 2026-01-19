<?php
// Конфигурация для безопасности
session_start();

// Базовые настройки
define('SITE_NAME', 'SMS Mailing');
define('SITE_URL', 'https://ваш-домен.com');

// Настройки безопасности
define('ENABLE_HTTPS', true);
define('SESSION_TIMEOUT', 3600); // 1 час

// Настройки Telegram Web App
define('TG_BOT_TOKEN', '8527321626:AAHGqnSLj6A0p5Rh6ccJxDoDG4dGOXbeQVk');
define('TG_WEB_APP_URL', 'https://t.me/sms_mailing_bot/web_app');

// Настройки базы данных (если будете использовать)
define('DB_HOST', 'localhost');
define('DB_NAME', 'sms_mailing');
define('DB_USER', 'root');
define('DB_PASS', '');

// Цены
define('SMS_PRICE_USDT', 1);
define('SMS_PRICE_TON', 1.63);

// Минимальные суммы депозита
define('MIN_DEPOSIT_USDT', 10);
define('MIN_DEPOSIT_TON', 10);
?>