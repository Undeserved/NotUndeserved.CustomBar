let socket;
let reconnectTimeout = null;
let dotNetRef = null;
let currentSessionId = null;
let storageListener = null;

const recentRedemptionIds = new Set();
const REDEMPTION_CACHE_DURATION = 60 * 1000; // 1 minute
const LOCK_KEY = "eventsub-lock";
const LOCK_TTL = 10000; // 10 seconds
const HEARTBEAT_INTERVAL = 5000; // 5 seconds


console.log("[twitchEventSub.js] Module loaded");

export function startTwitchWebSocket(ref, token, clientId, broadcasterUserId) {
    const instanceId = crypto.randomUUID(); // Unique per tab
    let heartbeatInterval = null;

    function tryAcquireLock() {
        const raw = localStorage.getItem(LOCK_KEY);
        const now = Date.now();

        if (!raw) {
            localStorage.setItem(LOCK_KEY, JSON.stringify({ id: instanceId, timestamp: now }));
            return true;
        }

        try {
            const parsed = JSON.parse(raw);
            if (now - parsed.timestamp > LOCK_TTL) {
                console.warn("[EventSub] Lock stale. Taking over.");
                localStorage.setItem(LOCK_KEY, JSON.stringify({ id: instanceId, timestamp: now }));
                return true;
            }

            return parsed.id === instanceId;
        } catch {
            return false;
        }
    }

    if (!tryAcquireLock()) {
        console.log("[EventSub] Lock held by another instance. Skipping WebSocket setup.");
        return;
    }

    heartbeatInterval = setInterval(() => {
        const raw = localStorage.getItem(LOCK_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.id === instanceId) {
                parsed.timestamp = Date.now();
                localStorage.setItem(LOCK_KEY, JSON.stringify(parsed));
            }
        }
    }, HEARTBEAT_INTERVAL);

    dotNetRef = ref;

    if (socket) {
        socket.close();
    }

    socket = new WebSocket("wss://eventsub.wss.twitch.tv/ws");
    //socket = new WebSocket("ws://localhost:8080/ws");

    socket.onopen = () => {
        console.log("[TwitchEventSub] WebSocket opened");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.metadata.message_type) {
            case "session_welcome":
                currentSessionId = data.payload.session.id;
                console.log("[TwitchEventSub] Session ID:", currentSessionId);
                subscribeToRewardRedemptions(currentSessionId, token, clientId, broadcasterUserId);
                break;

            case "notification":
                handleRedemption(data); 
                break;

            case "session_keepalive":
                console.log("[TwitchEventSub] Keepalive received");
                break;

            case "session_reconnect":
                const newUrl = data.payload.session.reconnect_url;
                console.log("[TwitchEventSub] Reconnecting to", newUrl);
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

    socket.onclose = (event) => {
        console.warn("[TwitchEventSub] WebSocket closed.");
        console.warn("Code:", event.code);
        console.warn("Reason:", event.reason);
        console.warn("Was clean:", event.wasClean);

        reconnectTimeout = setTimeout(() => startTwitchWebSocket(dotNetRef, token, clientId, broadcasterUserId), 5000);
    };

    socket.onerror = (err) => {
        console.error("[TwitchEventSub] Error:", err);
    };

    window.addEventListener("beforeunload", () => {
        const raw = localStorage.getItem(LOCK_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.id === instanceId) {
                localStorage.removeItem(LOCK_KEY);
            }
        }
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
    });
}

function reconnectWebSocket(url, token, clientId, broadcasterUserId) {
    socket = new WebSocket(url);

    socket.onopen = () => {
        console.log("[TwitchEventSub] Reconnected WebSocket opened");
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.metadata.message_type) {
            case "session_welcome":
                currentSessionId = data.payload.session.id;
                console.log("[TwitchEventSub] Reconnected session:", currentSessionId);
                subscribeToRewardRedemptions(currentSessionId, token, clientId, broadcasterUserId);
                break;

            case "notification":
                handleRedemption(data); 
                break;

            case "session_keepalive":
                console.log("[TwitchEventSub] Keepalive received (reconnect)");
                break;

            case "session_reconnect":
                const newUrl = data.payload.session.reconnect_url;
                console.log("[TwitchEventSub] Twitch instructed reconnect:", newUrl);
                reconnectWebSocket(newUrl, token, clientId, broadcasterUserId);
                break;

            case "revocation":
                console.warn("[TwitchEventSub] Subscription revoked (reconnect)", data.payload);
                break;

            default:
                console.log("[TwitchEventSub] Message (reconnect):", data);
                break;
        }
    };

    socket.onclose = (event) => {
        console.warn("[TwitchEventSub] WebSocket closed after reconnect.");
        console.warn("Code:", event.code);
        console.warn("Reason:", event.reason);
        console.warn("Was clean:", event.wasClean);

        reconnectTimeout = setTimeout(() => startTwitchWebSocket(dotNetRef, token, clientId, broadcasterUserId), 5000);
    };

    socket.onerror = (err) => {
        console.error("[TwitchEventSub] Error during reconnect:", err);
    };
}

function handleRedemption(data) {
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
}

async function subscribeToRewardRedemptions(sessionId, token, clientId, broadcasterUserId) {
    try {
        const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {        
        //const response = await fetch("http://localhost:8080/eventsub/subscriptions", {
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
    dotNetRef = null;
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    console.log("[TwitchEventSub] Disconnected");
}

//Storage handling functions
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
