const { default: fetch } = require('node-fetch');
const config = require('../config');
const { saveTwitchAccount } = require('../db/twitchAccounts');

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

async function tokenRequest(params) {
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        body: new URLSearchParams({
            client_id: config.twitch.clientId,
            client_secret: config.twitch.clientSecret,
            ...params
        })
    });
    return res.json();
}

// Кэш app access token (client_credentials) — Twitch не любит частые перевыпуски
let appToken = null;
let appTokenExpiresAt = 0;

// Получение application-токена Twitch (для проверки стримов)
async function getAppToken() {
    if (appToken && Date.now() < appTokenExpiresAt - 60_000) {
        return appToken;
    }

    const data = await tokenRequest({ grant_type: 'client_credentials' });
    if (!data.access_token) {
        console.error('❌ Не удалось получить app-токен Twitch:', data);
        return null;
    }

    appToken = data.access_token;
    appTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return appToken;
}

// Обмен authorization code на пользовательский токен (для /addall)
async function exchangeCode(code) {
    const data = await tokenRequest({
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.twitch.redirectUri
    });

    if (!data.access_token) {
        console.error('❌ Не удалось получить пользовательский токен Twitch:', data);
        return null;
    }
    return data; // { access_token, refresh_token, expires_in }
}

// Обновление пользовательского access token по refresh token
async function refreshUserToken(refreshToken) {
    const data = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });

    if (!data.access_token) {
        console.error('❌ Не удалось обновить пользовательский токен Twitch:', data);
        return null;
    }
    return data;
}

// Возвращает действующий access token для сохранённого аккаунта, обновляя при необходимости
async function ensureValidUserToken(account) {
    const isExpiringSoon = !account.expires_at || Date.now() > account.expires_at - 60_000;

    if (!isExpiringSoon) {
        return account.access_token;
    }

    const refreshed = await refreshUserToken(account.refresh_token);
    if (!refreshed) return null;

    saveTwitchAccount(
        account.chat_id,
        account.twitch_user_id,
        refreshed.access_token,
        refreshed.refresh_token,
        refreshed.expires_in
    );
    return refreshed.access_token;
}

// URL авторизации для команды /addall
function buildAuthUrl(state) {
    const url = new URL('https://id.twitch.tv/oauth2/authorize');
    url.searchParams.set('client_id', config.twitch.clientId);
    url.searchParams.set('redirect_uri', config.twitch.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'user:read:follows');
    url.searchParams.set('state', state);
    return url.toString();
}

module.exports = {
    getAppToken,
    exchangeCode,
    ensureValidUserToken,
    buildAuthUrl
};
