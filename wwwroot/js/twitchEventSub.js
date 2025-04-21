let socket;
let reconnectTimeout = null;
let heartbeatInterval = null;
let dotNetRef = null;
let currentSessionId = null;
let storageListener = null;

const recentRedemptionIds = new Set();
const REDEMPTION_CACHE_DURATION = 60 * 1000; // 1 minute

export function startTwitchWebSocket(ref, token, clientId, broadcasterUserId) {
    dotNetRef = ref;

    if (socket) {
        socket.close();
    }

    socket = new WebSocket("wss://eventsub.wss.twitch.tv/ws");

    socket.onopen = () => {
        console.log("[TwitchEventSub] WebSocket opened");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.metadata.message_type) {
            case "session_welcome":
                currentSessionId = data.payload.session.id;
                console.log("[TwitchEventSub] Session ID:", currentSessionId);
                startHeartbeat();
                subscribeToRewardRedemptions(currentSessionId, token, clientId, broadcasterUserId);
                break;

            case "notification":
                if (data.payload.subscription.type === "channel.channel_points_custom_reward_redemption.add") {
                    const redemption = data.payload.event;
                    const id = redemption.id;

                    if (!recentRedemptionIds.has(id)) {
                        recentRedemptionIds.add(id);
                        setTimeout(() => recentRedemptionIds.delete(id), REDEMPTION_CACHE_DURATION);

                        console.log("[TwitchEventSub] Redemption received:", redemption);
                        if (dotNetRef) {
                            dotNetRef.invokeMethodAsync("OnRedemptionReceived", redemption.user_name, redemption.reward.title);
                        }
                    } else {
                        console.log("[TwitchEventSub] Duplicate redemption ignored:", id);
                    }
                }
                break;

            case "session_keepalive":
                console.log("[TwitchEventSub] Keepalive received");
                break;

            case "session_reconnect":
                const newUrl = data.payload.session.reconnect_url;
                console.log("[TwitchEventSub] Reconnecting to", newUrl);
                stopHeartbeat();
                reconnectWebSocket(newUrl, token, clientId, broadcasterUserId);
                break;

            case "revocation":
                console.warn("[TwitchEventSub] Subscription revoked", data.payload);
                break;

            default:
                console.log("[TwitchEventSub] Message:", data);
                break;
        }
    };

    socket.onclose = () => {
        console.warn("[TwitchEventSub] WebSocket closed. Attempting to reconnect...");
        stopHeartbeat();
        reconnectTimeout = setTimeout(() => startTwitchWebSocket(ref, token, clientId, broadcasterUserId), 5000);
    };

    socket.onerror = (err) => {
        console.error("[TwitchEventSub] Error:", err);
    };
}

function reconnectWebSocket(url, token, clientId, broadcasterUserId) {
    socket = new WebSocket(url);

    socket.onopen = () => {
        console.log("[TwitchEventSub] Reconnected WebSocket opened");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.metadata.message_type === "session_welcome") {
            currentSessionId = data.payload.session.id;
            startHeartbeat();
            subscribeToRewardRedemptions(currentSessionId, token, clientId, broadcasterUserId);
        } else {
            // Reuse logic from the main onmessage handler
            socket.onmessage({ data: JSON.stringify(data) });
        }
    };

    socket.onclose = () => {
        console.warn("[TwitchEventSub] WebSocket closed after reconnect. Attempting to reconnect...");
        stopHeartbeat();
        reconnectTimeout = setTimeout(() => startTwitchWebSocket(dotNetRef, token, clientId, broadcasterUserId), 5000);
    };

    socket.onerror = (err) => {
        console.error("[TwitchEventSub] Error during reconnect:", err);
    };
}

function startHeartbeat() {
    stopHeartbeat();
    heartbeatInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "PING" }));
        }
    }, 60_000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

async function subscribeToRewardRedemptions(sessionId, token, clientId, broadcasterUserId) {
    try {
        const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Client-Id": clientId
            },
            body: JSON.stringify({
                type: "channel.channel_points_custom_reward_redemption.add",
                version: "1",
                condition: {
                    broadcaster_user_id: broadcasterUserId
                },
                transport: {
                    method: "websocket",
                    session_id: sessionId
                }
            })
        });

        const result = await response.json();
        console.log("[TwitchEventSub] Subscription result:", result);
    } catch (err) {
        console.error("[TwitchEventSub] Subscription failed:", err);
    }
}

export function stopTwitchWebSocket() {
    if (socket) {
        socket.close();
        socket = null;
    }
    stopHeartbeat();
    dotNetRef = null;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    console.log("[TwitchEventSub] Disconnected");
}

export function addStorageListener(dotNetRef) {
    storageListener = (event) => {
        if (event.key === "twitch-channel-name") {
            dotNetRef.invokeMethodAsync("OnChannelChanged");
        }
    };
    window.addEventListener("storage", storageListener);
}

export function removeStorageListener() {
    if (storageListener) {
        window.removeEventListener("storage", storageListener);
        storageListener = null;
    }
}
