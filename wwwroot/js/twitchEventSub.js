let socket;
let reconnectTimeout = null;
let heartbeatInterval = null;
let dotNetRef = null;
let currentSessionId = null;
let storageListener = null;

const recentRedemptionIds = new Set();
const REDEMPTION_CACHE_DURATION = 60 * 1000; // 1 minute

console.log("[twitchEventSub.js] Module loaded");
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

export function addStorageListener(ref) {
    dotNetRef = ref;

    storageListener = (event) => {
        if (event.key === "twitch-channel-name") {
            dotNetRef.invokeMethodAsync("OnChannelChanged");
        }

        if (event.key === 'widget_bar_image' || event.key === 'widget_dial_image') {
            dotNetRef.invokeMethodAsync('OnImageChanged');
        }
    };

    window.addEventListener('storage', storageListener);
    window.addEventListener('forceLocalStorageUpdate', () => {
        dotNetRef.invokeMethodAsync('OnImageChanged');
    });
}

export function dispatchForceLocalStorageUpdate() {
    // Trigger a manual storage event to simulate cross-tab sync (affects current tab too)
    window.dispatchEvent(new Event('forceLocalStorageUpdate'));
}

export function removeStorageListener() {
    if (storageListener) {
        window.removeEventListener("storage", storageListener);
        storageListener = null;
    }
}

export function createObjectUrl(file) {
    return URL.createObjectURL(file);
}

export function createObjectUrlFromInput(inputElement) {
    const file = inputElement.files?.[0];
    if (!file) {
        throw new Error("No file selected");
    }
    return URL.createObjectURL(file);
}

export async function readFileAsDataUrl(inputElement) {
    return new Promise((resolve, reject) => {
        const file = inputElement.files[0];
        if (!file) {
            resolve("");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function triggerFileInput(inputRef) {
    const input = inputRef instanceof HTMLElement ? inputRef : document.querySelector(`[data-blazor-id='${inputRef.id}']`) || inputRef;
    if (input && typeof input.click === "function") {
        input.click();
    } else {
        console.warn("triggerFileInput: could not find or click input element.");
    }
}

export function readTokenJson(input) {
    return new Promise((resolve, reject) => {
        const file = input.files[0];
        if (!file) return reject("No file selected");

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

export function downloadTokenJson(json) {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "twitch_token_backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
