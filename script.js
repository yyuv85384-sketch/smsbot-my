// Конфигурация
const CONFIG = {
    botToken: '8527321626:AAHGqnSLj6A0p5Rh6ccJxDoDG4dGOXbeQVk',
    adminGroupId: -1003629659528,
    smsPriceUSDT: 1,
    smsPriceTON: 1.63,
    apiUrl: 'api.php'
};

// Состояние приложения
let appState = {
    user: null,
    balance: {
        usdt: 0,
        ton: 0
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
    sendBtn.disabled = !(numberCount > 0 && message.length > 0 && appState.user);
}

// Отправка SMS
async function sendSMS() {
    if (!appState.user) {
        alert('Пожалуйста, авторизуйтесь');
        showAuthModal();
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
        alert(`Недостаточно средств. Требуется: ${requiredBalance} ${paymentMethod.toUpperCase()}`);
        showDepositModal();
        return;
    }
    
    // Подтверждение отправки
    if (!confirm(`Отправить рассылку на ${appState.currentSms.count} номеров? Стоимость: ${requiredBalance} ${paymentMethod.toUpperCase()}`)) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'send_sms',
                user_id: appState.user.id,
                numbers: appState.currentSms.numbers,
                message: appState.currentSms.message,
                payment_method: paymentMethod,
                price: requiredBalance
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ Заявка отправлена на модерацию! Ожидайте подтверждения.');
            
            // Сброс формы
            document.getElementById('numbers').value = '';
            document.getElementById('message').value = '';
            updateSMSInfo();
            
            // Обновление баланса
            updateBalance();
        } else {
            throw new Error(result.error || 'Ошибка отправки');
        }
    } catch (error) {
        console.error('Error sending SMS:', error);
        alert('❌ Ошибка при отправке: ' + error.message);
    } finally {
        showLoading(false);
    }
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
    
    // Генерация ссылки для Telegram
    const botLink = `https://t.me/sms_mailing_bot?start=web_auth_${generateCode()}`;
    document.getElementById('tg-auth-link').href = botLink;
    
    // QR код
    generateQRCode(botLink);
}

function generateCode() {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function generateQRCode(text) {
    // Здесь можно подключить библиотеку для генерации QR-кода
    // Например: new QRCode(document.querySelector(".qr-code"), text);
    document.querySelector('.qr-code').innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; display: inline-block;">
                <i class="fas fa-qrcode" style="font-size: 100px; color: #666;"></i>
            </div>
            <p style="margin-top: 10px; color: #666;">Отсканируйте QR-код камерой Telegram</p>
        </div>
    `;
}

async function verifyAuthCode() {
    const code = document.getElementById('auth-code').value.trim();
    
    if (!code) {
        alert('Введите код авторизации');
        return;
    }
    
    showLoading(true);
    
    try {
        // Здесь должна быть проверка кода через ваш бэкенд
        // Временная имитация успешной авторизации
        const mockUser = {
            id: Date.now(),
            first_name: 'Тестовый',
            username: 'test_user',
            photo_url: 'https://via.placeholder.com/150'
        };
        
        handleTelegramAuth(mockUser);
        document.getElementById('auth-modal').style.display = 'none';
    } catch (error) {
        alert('Неверный код авторизации');
    } finally {
        showLoading(false);
    }
}

function handleTelegramAuth(userData) {
    appState.user = {
        id: userData.id,
        name: userData.first_name,
        username: userData.username,
        avatar: userData.photo_url
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

// Баланс
async function updateBalance() {
    if (!appState.user) {
        setBalance(0, 0);
        return;
    }
    
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_balance',
                user_id: appState.user.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            setBalance(result.balance.usdt, result.balance.ton);
        }
    } catch (error) {
        console.error('Error fetching balance:', error);
    }
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
    } else {
        networkInfo.innerHTML = 'Сеть: <strong>The Open Network</strong>';
        document.getElementById('wallet-address').textContent = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';
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
    
    showLoading(true);
    
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'create_deposit',
                user_id: appState.user.id,
                amount: parseFloat(amount),
                currency: currency.toUpperCase()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Запрос на пополнение создан! Отправьте ${amount} ${currency.toUpperCase()} на указанный адрес и ожидайте подтверждения.`);
            document.getElementById('deposit-modal').style.display = 'none';
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Вспомогательные функции
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

// Заглушка для API
async function callAPI(action, data) {
    // Временная заглушка
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    switch (action) {
        case 'send_sms':
            return { success: true, message_id: Date.now() };
        case 'get_balance':
            return { success: true, balance: { usdt: 100, ton: 163 } };
        case 'create_deposit':
            return { success: true, deposit_id: 'dep_' + Date.now() };
        default:
            return { success: false, error: 'Unknown action' };
    }
}