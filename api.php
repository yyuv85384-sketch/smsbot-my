<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Конфигурация
define('BOT_TOKEN', '8527321626:AAHGqnSLj6A0p5Rh6ccJxDoDG4dGOXbeQVk');
define('ADMIN_GROUP_ID', -1003629659528);
define('DATA_FILE', 'users_data.json');

// Обработка CORS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// Получение данных
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? $_GET['action'] ?? '';

// Функции работы с данными
function loadData() {
    if (file_exists(DATA_FILE)) {
        return json_decode(file_get_contents(DATA_FILE), true);
    }
    return [];
}

function saveData($data) {
    file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Основной роутинг
switch ($action) {
    case 'send_sms':
        handleSendSMS($input);
        break;
    
    case 'get_balance':
        handleGetBalance($input);
        break;
    
    case 'create_deposit':
        handleCreateDeposit($input);
        break;
    
    case 'check_deposit':
        handleCheckDeposit($input);
        break;
    
    case 'get_history':
        handleGetHistory($input);
        break;
    
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
        break;
}

// Обработка отправки SMS
function handleSendSMS($data) {
    if (empty($data['user_id']) || empty($data['numbers']) || empty($data['message'])) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        return;
    }
    
    $userId = $data['user_id'];
    $numbers = $data['numbers'];
    $message = $data['message'];
    $paymentMethod = $data['payment_method'] ?? 'usdt';
    $price = $data['price'] ?? 0;
    
    // Сохраняем заявку
    $requestId = 'req_' . time() . '_' . rand(1000, 9999);
    
    // Отправляем в Telegram бот
    $telegramResult = sendToTelegramBot($userId, $numbers, $message, $requestId, $price, $paymentMethod);
    
    if ($telegramResult['success']) {
        echo json_encode(['success' => true, 'request_id' => $requestId]);
    } else {
        echo json_encode(['success' => false, 'error' => $telegramResult['error']]);
    }
}

// Отправка данных в Telegram бот
function sendToTelegramBot($userId, $numbers, $message, $requestId, $price, $paymentMethod) {
    $botToken = BOT_TOKEN;
    
    // Форматируем номера для отправки
    $formattedNumbers = '';
    foreach (array_slice($numbers, 0, 5) as $i => $num) {
        $formattedNumbers .= ($i + 1) . ". `$num`\n";
    }
    if (count($numbers) > 5) {
        $formattedNumbers .= "...и еще " . (count($numbers) - 5) . " номеров\n";
    }
    
    // Формируем сообщение для админа
    $adminMessage = urlencode(
        "📩 *НОВАЯ ЗАЯВКА С САЙТА*\n" .
        "━━━━━━━━━━━━━━━━━━\n" .
        "👤 *Пользователь:*\n" .
        "🆔 ID: `$userId`\n" .
        "🌐 *Источник:* Веб-сайт\n\n" .
        "📊 *Статистика:*\n" .
        "📱 Номеров: " . count($numbers) . " шт\n" .
        "💰 Стоимость: $price " . strtoupper($paymentMethod) . "\n\n" .
        "📋 *НОМЕРА:*\n" .
        "```\n$formattedNumbers```\n" .
        "💬 *ТЕКСТ СМС:*\n" .
        "```\n" . mb_substr($message, 0, 300) . (mb_strlen($message) > 300 ? '...' : '') . "```\n\n" .
        "🆔 *ID заявки:* `$requestId`"
    );
    
    // Кнопки для админа
    $keyboard = json_encode([
        'inline_keyboard' => [
            [
                ['text' => '✅ Подтвердить', 'callback_data' => 'web_ok_' . $userId . '_' . $requestId . '_' . $paymentMethod . '_' . $price],
                ['text' => '❌ Отклонить', 'callback_data' => 'web_no_' . $userId . '_' . $requestId]
            ]
        ]
    ]);
    
    // Отправляем сообщение админу
    $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
    $params = [
        'chat_id' => ADMIN_GROUP_ID,
        'text' => urldecode($adminMessage), // Исправлено: убрано urlencode
        'parse_mode' => 'Markdown',
        'reply_markup' => $keyboard
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    return [
        'success' => $result['ok'] ?? false,
        'message_id' => $result['result']['message_id'] ?? null,
        'error' => $result['description'] ?? null
    ];
}

// Получение баланса
function handleGetBalance($data) {
    if (empty($data['user_id'])) {
        echo json_encode(['success' => false, 'error' => 'User ID required']);
        return;
    }
    
    $usersData = loadData();
    $userId = (string)$data['user_id'];
    
    $balanceUSDT = $usersData[$userId]['balance_USDT'] ?? 0;
    $balanceTON = $usersData[$userId]['balance_TON'] ?? 0;
    
    echo json_encode([
        'success' => true,
        'balance' => [
            'usdt' => $balanceUSDT,
            'ton' => $balanceTON
        ]
    ]);
}

// Создание депозита
function handleCreateDeposit($data) {
    if (empty($data['user_id']) || empty($data['amount']) || empty($data['currency'])) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        return;
    }
    
    $userId = $data['user_id'];
    $amount = $data['amount'];
    $currency = $data['currency'];
    $depositId = 'dep_' . time() . '_' . rand(1000, 9999);
    
    // Генерация адреса в зависимости от валюты
    if ($currency == 'USDT') {
        $address = "TJSgjT9n1234567890abcdefghijklmnop";
        $network = "TRON (TRC20)";
    } else {
        $address = "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N";
        $network = "The Open Network";
    }
    
    // Отправляем уведомление админу
    $botToken = BOT_TOKEN;
    $adminMessage = 
        "💸 *НОВЫЙ ДЕПОЗИТ С САЙТА*\n" .
        "━━━━━━━━━━━━━━━━━━\n" .
        "👤 *Пользователь:*\n" .
        "🆔 ID: `$userId`\n" .
        "🌐 *Источник:* Веб-сайт\n\n" .
        "💰 *Детали депозита:*\n" .
        "💎 Сумма: $amount $currency\n" .
        "🌐 Сеть: $network\n\n" .
        "📨 *Адрес для проверки:*\n" .
        "`$address`\n\n" .
        "🆔 *ID депозита:* `$depositId`";
    
    $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
    $params = [
        'chat_id' => ADMIN_GROUP_ID,
        'text' => $adminMessage,
        'parse_mode' => 'Markdown'
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);
    
    echo json_encode([
        'success' => true,
        'deposit_id' => $depositId,
        'address' => $address,
        'network' => $network,
        'amount' => $amount,
        'currency' => $currency
    ]);
}

// Получение истории операций
function handleGetHistory($data) {
    if (empty($data['user_id'])) {
        echo json_encode(['success' => false, 'error' => 'User ID required']);
        return;
    }
    
    $usersData = loadData();
    $userId = (string)$data['user_id'];
    
    $transactions = $usersData[$userId]['transactions'] ?? [];
    
    // Ограничиваем последние 10 транзакций
    $recentTransactions = array_slice($transactions, -10);
    
    echo json_encode([
        'success' => true,
        'transactions' => $recentTransactions
    ]);
}

// Проверка депозита
function handleCheckDeposit($data) {
    // Временная заглушка
    echo json_encode(['success' => true, 'status' => 'pending']);
}
?>
