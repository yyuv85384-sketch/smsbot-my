<?php
// Отключите отображение ошибок в продакшене
error_reporting(0);
ini_set('display_errors', 0);

// Установите заголовки
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Конфигурация
define('BOT_TOKEN', '8527321626:AAHGqnSLj6A0p5Rh6ccJxDoDG4dGOXbeQVk');
define('ADMIN_GROUP_ID', -1003629659528);
define('DATA_FILE', 'users_data.json');

// Обработка CORS preflight запроса
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Получение входных данных
$input = file_get_contents('php://input');
$data = [];

if (!empty($input)) {
    $data = json_decode($input, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
        exit();
    }
}

// Получение action
$action = isset($data['action']) ? $data['action'] : (isset($_GET['action']) ? $_GET['action'] : '');

// Функции работы с данными
function loadData() {
    if (!file_exists(DATA_FILE)) {
        return [];
    }
    $content = file_get_contents(DATA_FILE);
    if (empty($content)) {
        return [];
    }
    return json_decode($content, true) ?: [];
}

function saveData($data) {
    file_put_contents(DATA_FILE, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Обработка действий
if (empty($action)) {
    echo json_encode(['success' => false, 'error' => 'No action specified']);
    exit();
}

switch ($action) {
    case 'send_sms':
        handleSendSMS($data);
        break;
    
    case 'get_balance':
        handleGetBalance($data);
        break;
    
    case 'create_deposit':
        handleCreateDeposit($data);
        break;
    
    case 'check_deposit':
        handleCheckDeposit($data);
        break;
    
    case 'get_history':
        handleGetHistory($data);
        break;
    
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
        break;
}

// Функция обработки отправки SMS
function handleSendSMS($data) {
    if (empty($data['user_id']) || empty($data['numbers']) || empty($data['message'])) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        return;
    }
    
    $userId = $data['user_id'];
    $numbers = is_array($data['numbers']) ? $data['numbers'] : [];
    $message = $data['message'];
    $paymentMethod = isset($data['payment_method']) ? $data['payment_method'] : 'usdt';
    $price = isset($data['price']) ? floatval($data['price']) : 0;
    
    // Проверка наличия номеров
    if (empty($numbers)) {
        echo json_encode(['success' => false, 'error' => 'No phone numbers provided']);
        return;
    }
    
    // Генерация ID заявки
    $requestId = 'req_' . time() . '_' . rand(1000, 9999);
    
    // Отправка в Telegram
    $result = sendToTelegramBot($userId, $numbers, $message, $requestId, $price, $paymentMethod);
    
    if ($result['success']) {
        echo json_encode([
            'success' => true,
            'request_id' => $requestId,
            'message' => 'Заявка отправлена на модерацию'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => 'Failed to send to Telegram: ' . $result['error']
        ]);
    }
}

// Отправка в Telegram бот
function sendToTelegramBot($userId, $numbers, $message, $requestId, $price, $paymentMethod) {
    $botToken = BOT_TOKEN;
    
    // Форматирование номеров
    $formattedNumbers = '';
    $count = min(count($numbers), 5);
    for ($i = 0; $i < $count; $i++) {
        $formattedNumbers .= ($i + 1) . ". `{$numbers[$i]}`\n";
    }
    if (count($numbers) > 5) {
        $formattedNumbers .= "...и еще " . (count($numbers) - 5) . " номеров\n";
    }
    
    // Сообщение для админа
    $adminMessage = "📩 *НОВАЯ ЗАЯВКА С САЙТА*\n" .
                    "━━━━━━━━━━━━━━━━━━\n" .
                    "👤 *Пользователь:*\n" .
                    "🆔 ID: `{$userId}`\n" .
                    "🌐 *Источник:* Веб-сайт\n\n" .
                    "📊 *Статистика:*\n" .
                    "📱 Номеров: " . count($numbers) . " шт\n" .
                    "💰 Стоимость: {$price} " . strtoupper($paymentMethod) . "\n\n" .
                    "📋 *НОМЕРА:*\n" .
                    "```\n{$formattedNumbers}```\n" .
                    "💬 *ТЕКСТ СМС:*\n" .
                    "```\n" . mb_substr($message, 0, 300) . (mb_strlen($message) > 300 ? '...' : '') . "```\n\n" .
                    "🆔 *ID заявки:* `{$requestId}`";
    
    // Клавиатура для админа
    $keyboard = [
        'inline_keyboard' => [
            [
                [
                    'text' => '✅ Подтвердить',
                    'callback_data' => 'web_ok_' . $userId . '_' . $requestId . '_' . $paymentMethod . '_' . $price
                ],
                [
                    'text' => '❌ Отклонить',
                    'callback_data' => 'web_no_' . $userId . '_' . $requestId
                ]
            ]
        ]
    ];
    
    // Отправка запроса к Telegram API
    $url = "https://api.telegram.org/bot{$botToken}/sendMessage";
    $params = [
        'chat_id' => ADMIN_GROUP_ID,
        'text' => $adminMessage,
        'parse_mode' => 'Markdown',
        'reply_markup' => json_encode($keyboard)
    ];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($response === false) {
        return ['success' => false, 'error' => 'CURL error'];
    }
    
    $result = json_decode($response, true);
    
    return [
        'success' => isset($result['ok']) && $result['ok'],
        'message_id' => isset($result['result']['message_id']) ? $result['result']['message_id'] : null,
        'error' => isset($result['description']) ? $result['description'] : null
    ];
}

// Функция получения баланса
function handleGetBalance($data) {
    if (empty($data['user_id'])) {
        echo json_encode(['success' => false, 'error' => 'User ID required']);
        return;
    }
    
    $userId = (string)$data['user_id'];
    $usersData = loadData();
    
    $balanceUSDT = isset($usersData[$userId]['balance_USDT']) ? floatval($usersData[$userId]['balance_USDT']) : 0;
    $balanceTON = isset($usersData[$userId]['balance_TON']) ? floatval($usersData[$userId]['balance_TON']) : 0;
    
    echo json_encode([
        'success' => true,
        'balance' => [
            'usdt' => $balanceUSDT,
            'ton' => $balanceTON
        ]
    ]);
}

// Функция создания депозита
function handleCreateDeposit($data) {
    if (empty($data['user_id']) || empty($data['amount']) || empty($data['currency'])) {
        echo json_encode(['success' => false, 'error' => 'Missing required fields']);
        return;
    }
    
    $userId = $data['user_id'];
    $amount = floatval($data['amount']);
    $currency = strtoupper($data['currency']);
    
    // Проверка минимальной суммы
    $minDeposit = 10;
    if ($amount < $minDeposit) {
        echo json_encode(['success' => false, 'error' => "Минимальная сумма {$minDeposit} {$currency}"]);
        return;
    }
    
    $depositId = 'dep_' . time() . '_' . rand(1000, 9999);
    
    // Адрес в зависимости от валюты
    if ($currency === 'USDT') {
        $address = "TJSgjT9n1234567890abcdefghijklmnop";
        $network = "TRON (TRC20)";
    } else {
        $address = "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N";
        $network = "The Open Network";
    }
    
    // Отправка уведомления админу
    $botToken = BOT_TOKEN;
    $adminMessage = "💸 *НОВЫЙ ДЕПОЗИТ С САЙТА*\n" .
                    "━━━━━━━━━━━━━━━━━━\n" .
                    "👤 *Пользователь:*\n" .
                    "🆔 ID: `{$userId}`\n" .
                    "🌐 *Источник:* Веб-сайт\n\n" .
                    "💰 *Детали депозита:*\n" .
                    "💎 Сумма: {$amount} {$currency}\n" .
                    "🌐 Сеть: {$network}\n\n" .
                    "📨 *Адрес для пополнения:*\n" .
                    "`{$address}`\n\n" .
                    "🆔 *ID депозита:* `{$depositId}`";
    
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
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_exec($ch);
    curl_close($ch);
    
    echo json_encode([
        'success' => true,
        'deposit_id' => $depositId,
        'address' => $address,
        'network' => $network,
        'amount' => $amount,
        'currency' => $currency,
        'message' => 'Депозит создан. Отправьте средства на указанный адрес.'
    ]);
}

// Функция получения истории
function handleGetHistory($data) {
    if (empty($data['user_id'])) {
        echo json_encode(['success' => false, 'error' => 'User ID required']);
        return;
    }
    
    $userId = (string)$data['user_id'];
    $usersData = loadData();
    
    $transactions = isset($usersData[$userId]['transactions']) ? $usersData[$userId]['transactions'] : [];
    
    // Последние 10 транзакций
    $recentTransactions = array_slice(array_reverse($transactions), 0, 10);
    
    echo json_encode([
        'success' => true,
        'transactions' => $recentTransactions
    ]);
}

// Функция проверки депозита
function handleCheckDeposit($data) {
    echo json_encode([
        'success' => true,
        'status' => 'pending',
        'message' => 'Депозит находится в обработке'
    ]);
}
?>
