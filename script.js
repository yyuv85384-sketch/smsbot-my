[file name]: script.js
[file content begin]
// Конфигурация
const CONFIG = {
    botToken: '8527321626:AAHGqnSLj6A0p5Rh6ccJxDoDG4dGOXbeQVk',
    adminGroupId: -1003629659528,
    smsPriceUSDT: 1,
    smsPriceTON: 1.63,
    // Удаляем apiUrl - будем работать напрямую с Telegram API
};

// Состояние приложения
let appState = {
    user: null,
    balance: {
        usdt: 100, // Тестовые данные
        ton: 163
    },
    prices: {
        usdt: CONFIG.smsPriceUSDT,
        ton: CONFIG.smsPriceTON
    },
    currentSms: {
        numbers: '',
        message: '',
        count: 0,
        price: {
            usdt: 0,
            ton: 0
        }
    }
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupEventListeners();
    checkAuth();
});

function initApp() {
    // Проверяем авторизацию в Telegram Web App
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        
        if (tg.initDataUnsafe?.user) {
            handleTelegramAuth(tg.initDataUnsafe.user);
        }
    }
}

function setupEventListeners() {
    // Форма отправки SMS
    const numbersInput = document.getElementById('numbers');
    const messageInput = document.getElementById('message');
    const sendBtn = document.getElementById('send-btn');
    
    numbersInput.addEventListener('input', updateSMSInfo);
    messageInput.addEventListener('input', updateSMSInfo);
    
    sendBtn.addEventListener('click', sendSMS);
    
    // Авторизация
    const authBtn = document.getElementById('auth-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const verifyBtn = document.getElementById('verify-code');
    
    authBtn.addEventListener('click', showAuthModal);
    logoutBtn.addEventListener('click', logout);
    verifyBtn.addEventListener('click', verifyAuthCode);
    
    // Пополнение баланса
    const depositBtn = document.getElementById('deposit-btn');
    depositBtn.addEventListener('click', showDepositModal);
    
    // Модальные окна
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close');
    
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modals.forEach(modal => modal.style.display = 'none');
        });
    });
    
    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Выбор суммы депозита
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            document.getElementById('custom-amount').value = this.dataset.amount;
        });
    });
    
    document.getElementById('custom-amount').addEventListener('input', function() {
        document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
    });
    
    document.querySelectorAll('.currency-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.currency-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const currency = this.dataset.currency;
            updateDepositCurrency(currency);
        });
    });
    
    // Копирование адреса
    document.querySelector('.btn-copy').addEventListener('click', copyWalletAddress);
    
    // Подтверждение депозита
    document.getElementById('confirm-deposit').addEventListener('click', confirmDeposit);
}

// Обновление информации о SMS
function updateSMSInfo() {
    const numbers = document.getElementById('numbers').value;
    const message = document.getElementById('message').value;
    
    // Подсчет номеров
    const numberList = numbers.split(';').filter(n => n.trim().length > 0);
    const validNumbers = numberList.filter(n => {
        const num = n.trim();
        return num.startsWith('+7') || num.startsWith('7') || num.startsWith('8');
    });
    
    const numberCount = validNumbers.length;
    const charCount = message.length;
    
    // Обновление счетчиков
    document.getElementById('number-count').textContent = numberCount;
    document.getElementById('char-count').textContent = charCount;
    document.getElementById('sms-count').textContent = numberCount;
    
    // Расчет стоимости
    const priceUSDT = (numberCount * CONFIG.smsPriceUSDT).toFixed(2);
    const priceTON = (numberCount * CONFIG.smsPriceTON).toFixed(2);
    
    document.getElementById('price-usdt').textContent = priceUSDT;
    document.getElementById('price-ton').textContent = priceTON;
    
    // Сохранение в состоянии
    appState.currentSms = {
        numbers: validNumbers,
        message: message,
        count: numberCount,
        price: {
            usdt: parseFloat(priceUSDT),
            ton: parseFloat(priceTON)
        }
    };
    
    // Активация кнопки отправки
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = !(numberCount > 0 && message.length > 0);
}

// Отправка SMS через Telegram Bot API напрямую
async function sendSMS() {
    if (!appState.user) {
        alert('Пожалуйста, авторизуйтесь через Telegram бота для отправки SMS');
        return;
    }
    
    if (appState.currentSms.count === 0) {
        alert('Добавьте номера телефонов');
        return;
    }
    
    if (appState.currentSms.message.length === 0) {
        alert('Введите текст сообщения');
        return;
    }
    
    // Проверка баланса
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
    const requiredBalance = paymentMethod === 'usdt' 
        ? appState.currentSms.price.usdt 
        : appState.currentSms.price.ton;
    
    const currentBalance = paymentMethod === 'usdt' 
        ? appState.balance.usdt 
        : appState.balance.ton;
    
    if (requiredBalance > currentBalance) {
        alert(`Недостаточно средств. Требуется: ${requiredBalance} ${paymentMethod.toUpperCase()}\nПополните баланс через Telegram бота.`);
        return;
    }
    
    // Подтверждение отправки
    if (!confirm(`Отправить рассылку на ${appState.currentSms.count} номеров?\nСтоимость: ${requiredBalance} ${paymentMethod.toUpperCase()}\n\nПосле нажатия ОК перейдите в Telegram бота для подтверждения.`)) {
        return;
    }
    
    // Сохраняем данные в localStorage для передачи боту
    localStorage.setItem('sms_draft', JSON.stringify({
        numbers: appState.currentSms.numbers,
        message: appState.currentSms.message,
        count: appState.currentSms.count,
        price: requiredBalance,
        currency: paymentMethod,
        timestamp: Date.now()
    }));
    
    // Открываем Telegram бота
    window.open('https://t.me/sms_mailing_bot', '_blank');
    
    // Показываем инструкцию
    alert('✅ Данные сохранены!\n\nТеперь:\n1. Откройте Telegram бота @sms_mailing_bot\n2. Нажмите "🚀 Запустить рассылку"\n3. Номера и текст будут автоматически подставлены\n4. Оплатите и отправьте SMS');
    
    // Сброс формы
    document.getElementById('numbers').value = '';
    document.getElementById('message').value = '';
    updateSMSInfo();
}

// Авторизация
function checkAuth() {
    const savedUser = localStorage.getItem('sms_user');
    if (savedUser) {
        try {
            appState.user = JSON.parse(savedUser);
            updateUI();
            updateBalance();
        } catch (e) {
            localStorage.removeItem('sms_user');
        }
    }
}

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
    
    // Генерация уникального кода
    const authCode = generateCode();
    localStorage.setItem('sms_auth_code', authCode);
    
    // Ссылка для Telegram бота с кодом
    const botLink = `https://t.me/sms_mailing_bot?start=web_auth_${authCode}`;
    document.getElementById('tg-auth-link').href = botLink;
    
    // QR код
    generateQRCode(botLink);
}

function generateCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateQRCode(text) {
    document.querySelector('.qr-code').innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; display: inline-block;">
                <i class="fas fa-qrcode" style="font-size: 100px; color: #666;"></i>
            </div>
            <p style="margin-top: 10px; color: #666;">Отсканируйте QR-код или нажмите кнопку ниже</p>
        </div>
    `;
}

async function verifyAuthCode() {
    const code = document.getElementById('auth-code').value.trim();
    
    if (!code) {
        alert('Введите код авторизации');
        return;
    }
    
    // Проверяем код (в реальности это делается через бота)
    const savedCode = localStorage.getItem('sms_auth_code');
    
    if (code === savedCode || code.length === 8) {
        // Успешная авторизация
        const mockUser = {
            id: Date.now(),
            first_name: 'Пользователь',
            username: 'user_' + Date.now(),
            photo_url: 'https://ui-avatars.com/api/?name=User&background=0088cc&color=fff'
        };
        
        handleTelegramAuth(mockUser);
        document.getElementById('auth-modal').style.display = 'none';
        alert('✅ Авторизация успешна!');
    } else {
        alert('❌ Неверный код авторизации');
    }
}

function handleTelegramAuth(userData) {
    appState.user = {
        id: userData.id,
        name: userData.first_name || 'Пользователь',
        username: userData.username || 'user_' + userData.id,
        avatar: userData.photo_url || 'https://ui-avatars.com/api/?name=User&background=0088cc&color=fff'
    };
    
    localStorage.setItem('sms_user', JSON.stringify(appState.user));
    updateUI();
    updateBalance();
}

function logout() {
    if (confirm('Вы действительно хотите выйти?')) {
        appState.user = null;
        localStorage.removeItem('sms_user');
        updateUI();
    }
}

// Обновление UI
function updateUI() {
    const authBtn = document.getElementById('auth-btn');
    const userProfile = document.getElementById('user-profile');
    
    if (appState.user) {
        authBtn.classList.add('hidden');
        userProfile.classList.remove('hidden');
        
        document.getElementById('user-name').textContent = appState.user.name;
        document.getElementById('user-id').textContent = `ID: ${appState.user.id}`;
        
        if (appState.user.avatar) {
            document.getElementById('user-avatar').src = appState.user.avatar;
        }
    } else {
        authBtn.classList.remove('hidden');
        userProfile.classList.add('hidden');
    }
}

// Баланс (тестовые данные)
function updateBalance() {
    // Устанавливаем тестовые значения баланса
    setBalance(appState.balance.usdt, appState.balance.ton);
}

function setBalance(usdt, ton) {
    appState.balance.usdt = usdt;
    appState.balance.ton = ton;
    
    // Обновление UI
    document.getElementById('balance-usdt').textContent = usdt + ' USDT';
    document.getElementById('balance-ton').textContent = ton + ' TON';
    document.getElementById('sidebar-balance-usdt').textContent = usdt;
    document.getElementById('sidebar-balance-ton').textContent = ton;
}

// Пополнение баланса
function showDepositModal() {
    if (!appState.user) {
        alert('Пожалуйста, авторизуйтесь');
        showAuthModal();
        return;
    }
    
    document.getElementById('deposit-modal').style.display = 'flex';
    updateDepositCurrency('usdt');
}

function updateDepositCurrency(currency) {
    const symbol = currency.toUpperCase();
    document.querySelector('.currency-symbol').textContent = symbol;
    
    // Обновление информации о сети
    const networkInfo = document.querySelector('.info-card p:nth-child(2)');
    if (currency === 'usdt') {
        networkInfo.innerHTML = 'Сеть: <strong>TRON (TRC20)</strong>';
        document.getElementById('wallet-address').textContent = 'TJSgjT9n1234567890abcdefghijklmnop';
        document.querySelector('.info-card p:nth-child(1)').innerHTML = 'Минимальная сумма: <strong>10 USDT</strong>';
    } else {
        networkInfo.innerHTML = 'Сеть: <strong>The Open Network</strong>';
        document.getElementById('wallet-address').textContent = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';
        document.querySelector('.info-card p:nth-child(1)').innerHTML = 'Минимальная сумма: <strong>10 TON</strong>';
    }
}

function copyWalletAddress() {
    const address = document.getElementById('wallet-address').textContent;
    navigator.clipboard.writeText(address).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    });
}

async function confirmDeposit() {
    const currency = document.querySelector('.currency-btn.active').dataset.currency;
    const amount = document.getElementById('custom-amount').value;
    
    if (!amount || parseFloat(amount) < 10) {
        alert('Минимальная сумма 10');
        return;
    }
    
    // Сохраняем данные о депозите
    const depositData = {
        user_id: appState.user ? appState.user.id : 'anonymous',
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        address: document.getElementById('wallet-address').textContent,
        network: currency === 'usdt' ? 'TRON (TRC20)' : 'The Open Network',
        timestamp: Date.now()
    };
    
    localStorage.setItem('sms_deposit', JSON.stringify(depositData));
    
    alert(`✅ Запрос на пополнение сохранен!\n\nОтправьте ${amount} ${currency.toUpperCase()} на адрес:\n\n${depositData.address}\n\nПосле отправки перейдите в Telegram бота и нажмите "✅ Проверить платеж"`);
    
    document.getElementById('deposit-modal').style.display = 'none';
    
    // Открываем Telegram бота
    window.open('https://t.me/sms_mailing_bot', '_blank');
}

// Вспомогательные функции
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}
[file content end]
