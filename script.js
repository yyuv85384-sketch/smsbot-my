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
        numbers: [],
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
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
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
    const copyBtn = document.querySelector('.btn-copy');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyWalletAddress);
    }
    
    // Подтверждение депозита
    const confirmBtn = document.getElementById('confirm-deposit');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmDeposit);
    }
}

// Обновление информации о SMS
function updateSMSInfo() {
    const numbers = document.getElementById('numbers').value;
    const message = document.getElementById('message').value;
    
    // Подсчет номеров
    const numberList = numbers.split(';')
        .map(n => n.trim())
        .filter(n => n.length > 0);
    
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
    
    // Обновление стиля кнопки
    if (sendBtn.disabled) {
        sendBtn.style.opacity = '0.6';
        sendBtn.style.cursor = 'not-allowed';
    } else {
        sendBtn.style.opacity = '1';
        sendBtn.style.cursor = 'pointer';
    }
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
        document.getElementById('numbers').focus();
        return;
    }
    
    if (appState.currentSms.message.length === 0) {
        alert('Введите текст сообщения');
        document.getElementById('message').focus();
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
        const currency = paymentMethod.toUpperCase();
        alert(`Недостаточно средств. Требуется: ${requiredBalance} ${currency}\nВаш баланс: ${currentBalance} ${currency}`);
        showDepositModal();
        return;
    }
    
    // Подтверждение отправки
    if (!confirm(`Отправить рассылку на ${appState.currentSms.count} номеров?\nСтоимость: ${requiredBalance} ${paymentMethod.toUpperCase()}\n\nПродолжить?`)) {
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
            updateHistory();
        } catch (e) {
            console.error('Error parsing user data:', e);
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
    const qrCodeElement = document.querySelector('.qr-code');
    if (qrCodeElement) {
        qrCodeElement.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; display: inline-block;">
                    <i class="fas fa-qrcode" style="font-size: 100px; color: #666;"></i>
                </div>
                <p style="margin-top: 10px; color: #666;">Отсканируйте QR-код камерой Telegram</p>
            </div>
        `;
    }
}

async function verifyAuthCode() {
    const code = document.getElementById('auth-code').value.trim();
    
    if (!code) {
        alert('Введите код авторизации');
        return;
    }
    
    showLoading(true);
    
    try {
        // Имитация проверки кода
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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
        name: userData.first_name || 'Пользователь',
        username: userData.username || 'без имени',
        avatar: userData.photo_url || 'https://via.placeholder.com/150'
    };
    
    localStorage.setItem('sms_user', JSON.stringify(appState.user));
    updateUI();
    updateBalance();
    updateHistory();
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
        
        const avatarImg = document.getElementById('user-avatar');
        if (avatarImg) {
            avatarImg.src = appState.user.avatar;
            avatarImg.alt = appState.user.name;
        }
        
        // Обновляем статистику
        updateStats();
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
        } else {
            console.error('Balance error:', result.error);
            setBalance(0, 0);
        }
    } catch (error) {
        console.error('Error fetching balance:', error);
        setBalance(0, 0);
    }
}

function setBalance(usdt, ton) {
    appState.balance.usdt = usdt;
    appState.balance.ton = ton;
    
    // Обновление UI
    document.getElementById('balance-usdt').textContent = usdt.toFixed(2) + ' USDT';
    document.getElementById('balance-ton').textContent = ton.toFixed(2) + ' TON';
    document.getElementById('sidebar-balance-usdt').textContent = usdt.toFixed(2);
    document.getElementById('sidebar-balance-ton').textContent = ton.toFixed(2);
}

// Обновление истории
async function updateHistory() {
    if (!appState.user) {
        clearHistory();
        return;
    }
    
    try {
        const response = await fetch(CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get_history',
                user_id: appState.user.id
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayHistory(result.transactions || []);
        } else {
            clearHistory();
        }
    } catch (error) {
        console.error('Error fetching history:', error);
        clearHistory();
    }
}

function displayHistory(transactions) {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;
    
    if (!transactions || transactions.length === 0) {
        clearHistory();
        return;
    }
    
    let html = '';
    transactions.forEach(transaction => {
        const type = transaction.type || 'unknown';
        const amount = transaction.amount || 0;
        const currency = transaction.currency || '';
        const timestamp = transaction.timestamp || 'Недавно';
        
        let icon = 'fa-exchange-alt';
        let color = 'blue';
        let text = '';
        
        if (type === 'deposit') {
            icon = 'fa-plus-circle';
            color = 'green';
            text = `Пополнение: +${amount} ${currency}`;
        } else if (type === 'payment') {
            icon = 'fa-minus-circle';
            color = 'orange';
            text = `Списание: -${amount} ${currency}`;
        } else {
            text = `${type}: ${amount} ${currency}`;
        }
        
        html += `
            <div class="history-item">
                <div class="history-icon" style="background-color: ${color};">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="history-details">
                    <div class="history-amount">${text}</div>
                    <div class="history-date">${timestamp}</div>
                </div>
            </div>
        `;
    });
    
    historyList.innerHTML = html;
}

function clearHistory() {
    const historyList = document.getElementById('history-list');
    if (historyList) {
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-inbox"></i>
                <p>Нет операций</p>
            </div>
        `;
    }
}

// Обновление статистики
function updateStats() {
    // Здесь можно добавить реальные данные статистики
    document.getElementById('total-sent').textContent = '0';
    document.getElementById('success-rate').textContent = '0%';
    document.getElementById('total-cost').textContent = '0 USDT';
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
    const currencySymbol = document.querySelector('.currency-symbol');
    if (currencySymbol) {
        currencySymbol.textContent = symbol;
    }
    
    // Обновление информации о сети
    const networkInfo = document.querySelector('.info-card p:nth-child(2)');
    const walletAddress = document.getElementById('wallet-address');
    
    if (currency === 'usdt') {
        if (networkInfo) {
            networkInfo.innerHTML = 'Сеть: <strong>TRON (TRC20)</strong>';
        }
        if (walletAddress) {
            walletAddress.textContent = 'TJSgjT9n1234567890abcdefghijklmnop';
        }
        document.querySelector('.currency-symbol').textContent = 'USDT';
    } else {
        if (networkInfo) {
            networkInfo.innerHTML = 'Сеть: <strong>The Open Network</strong>';
        }
        if (walletAddress) {
            walletAddress.textContent = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';
        }
        document.querySelector('.currency-symbol').textContent = 'TON';
    }
    
    // Обновление минимальной суммы
    const minAmount = document.querySelector('.info-card p:nth-child(1)');
    if (minAmount) {
        minAmount.innerHTML = `Минимальная сумма: <strong>10 ${symbol}</strong>`;
    }
}

function copyWalletAddress() {
    const addressElement = document.getElementById('wallet-address');
    if (!addressElement) return;
    
    const address = addressElement.textContent;
    
    navigator.clipboard.writeText(address).then(() => {
        const btn = document.querySelector('.btn-copy');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
            btn.style.background = '#28a745';
            
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '';
            }, 2000);
        }
    }).catch(err => {
        console.error('Copy failed:', err);
        alert('Не удалось скопировать адрес');
    });
}

async function confirmDeposit() {
    const currencyBtn = document.querySelector('.currency-btn.active');
    if (!currencyBtn) {
        alert('Выберите валюту');
        return;
    }
    
    const currency = currencyBtn.dataset.currency;
    const amountInput = document.getElementById('custom-amount');
    const amount = amountInput.value.trim();
    
    if (!amount) {
        alert('Введите сумму пополнения');
        amountInput.focus();
        return;
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 10) {
        alert('Минимальная сумма 10');
        amountInput.focus();
        return;
    }
    
    if (!appState.user) {
        alert('Пожалуйста, авторизуйтесь');
        showAuthModal();
        return;
    }
    
    if (!confirm(`Создать запрос на пополнение на сумму ${amountNum} ${currency.toUpperCase()}?`)) {
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
                amount: amountNum,
                currency: currency.toUpperCase()
            })
        });
        
        // Проверяем ответ
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(`✅ Запрос на пополнение создан!\n\nОтправьте ${amountNum} ${currency.toUpperCase()} на адрес:\n${result.address}\n\nПосле отправки средств ожидайте подтверждения.`);
            document.getElementById('deposit-modal').style.display = 'none';
            
            // Сброс формы
            amountInput.value = '';
            document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
            
            // Обновление истории
            updateHistory();
        } else {
            throw new Error(result.error || 'Ошибка при создании депозита');
        }
    } catch (error) {
        console.error('Deposit error:', error);
        alert('❌ Ошибка: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Вспомогательные функции
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'flex' : 'none';
    }
}

// Инициализация статистики
updateStats();
