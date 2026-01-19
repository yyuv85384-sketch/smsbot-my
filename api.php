[file name]: api.php
[file content begin]
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Простой API, который всегда возвращает успешный ответ
echo json_encode([
    'success' => true,
    'message' => 'API работает. Для полной функциональности используйте Telegram бота.',
    'data' => [
        'balance' => ['usdt' => 100, 'ton' => 163],
        'status' => 'active'
    ]
]);
?>
