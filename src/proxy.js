const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const config = require('./config');

// Создаёт прокси-агент из PROXY_URL (или null, если прокси не задан).
// Прокси используется ТОЛЬКО для запросов к Telegram API —
// запросы к Twitch идут напрямую, без прокси.
function createProxyAgent() {
    const proxyUrl = config.proxyUrl;
    if (!proxyUrl) return null;

    try {
        const protocol = proxyUrl.split('://')[0].toLowerCase();

        if (protocol.startsWith('socks')) {
            console.log(`🌐 Используется SOCKS-прокси (${protocol}) для Telegram API`);
            return new SocksProxyAgent(proxyUrl);
        }

        if (protocol === 'http' || protocol === 'https') {
            console.log('🌐 Используется HTTP(S)-прокси для Telegram API');
            return new HttpsProxyAgent(proxyUrl);
        }

        console.warn(`⚠️ Неизвестный протокол прокси "${protocol}", прокси не будет использован.`);
        return null;
    } catch (err) {
        console.error('❌ Ошибка при создании прокси-агента:', err.message);
        return null;
    }
}

// Единый агент на всё приложение
module.exports = createProxyAgent();
