const { default: fetch } = require('node-fetch');
const config = require('../config');

const HELIX = 'https://api.twitch.tv/helix';

function helixHeaders(accessToken) {
    return {
        'Client-ID': config.twitch.clientId,
        'Authorization': `Bearer ${accessToken}`
    };
}

// Получить Twitch user_id владельца пользовательского токена
async function getSelfUserId(userAccessToken) {
    const res = await fetch(`${HELIX}/users`, {
        headers: helixHeaders(userAccessToken)
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data.data) || data.data.length === 0) return null;
    return data.data[0].id;
}

// Получить ID канала по имени (null — канал не найден или ошибка)
async function getChannelId(appToken, username) {
    const res = await fetch(`${HELIX}/users?login=${encodeURIComponent(username)}`, {
        headers: helixHeaders(appToken)
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data.data) || data.data.length === 0) return null;
    return data.data[0].id;
}

// Стримит ли канал: true/false, либо null при ошибке API
// (null важен: ошибка не должна трактоваться как "стрим закончился")
async function isStreaming(appToken, channelId) {
    const res = await fetch(`${HELIX}/streams?user_id=${encodeURIComponent(channelId)}`, {
        headers: helixHeaders(appToken)
    });

    if (!res.ok) {
        console.error('Ошибка при запросе статуса стрима:', res.statusText);
        return null;
    }

    const data = await res.json();
    return Array.isArray(data.data) && data.data.length > 0;
}

// Список каналов, на которые подписан пользователь (с пагинацией)
// null при ошибке — чтобы вызывающий код не принял сбой за массовые отписки
async function getFollowedChannels(userAccessToken, userId) {
    const channels = [];
    let cursor = null;

    do {
        const url = new URL(`${HELIX}/channels/followed`);
        url.searchParams.set('user_id', userId);
        url.searchParams.set('first', '100');
        if (cursor) url.searchParams.set('after', cursor);

        const res = await fetch(url.toString(), {
                headers: helixHeaders(userAccessToken)
        });

        if (!res.ok) {
            console.error('Ошибка при получении подписок Twitch:', res.statusText);
            return null;
        }

        const data = await res.json();
        for (const item of data.data || []) {
            channels.push(item.broadcaster_login);
        }

        cursor = data.pagination?.cursor || null;
    } while (cursor);

    return channels;
}

module.exports = {
    getSelfUserId,
    getChannelId,
    isStreaming,
    getFollowedChannels
};
