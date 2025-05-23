export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight support
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    // Return the client ID (for use in frontend OAuth redirect URL)
    if (url.pathname === "/client-id") {
      return new Response(JSON.stringify({ client_id: env.TWITCH_CLIENT_ID }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    }

    // Exchange auth code for access token
    if (url.pathname === "/token" && request.method === "POST") {
      const params = await request.json();
      const code = params.code;
      const redirectUri = params.redirect_uri;

      const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: env.TWITCH_CLIENT_ID,
          client_secret: env.TWITCH_CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        return new Response(JSON.stringify(tokenData), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
          status: 400
        });
      }

      const userResponse = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Authorization": `Bearer ${tokenData.access_token}`,
          "Client-Id": env.TWITCH_CLIENT_ID
        }
      });

      const userData = await userResponse.json();
      const login = userData.data?.[0]?.login ?? null;

      const result = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        login: login
      };

      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Refresh access token
    if (url.pathname === "/refresh" && request.method === "POST") {
      const body = await request.json();
      const refreshToken = body.refresh_token;

      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", refreshToken);
      params.append("client_id", env.TWITCH_CLIENT_ID);
      params.append("client_secret", env.TWITCH_CLIENT_SECRET);

      const response = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        body: params
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Fallback for unknown routes
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
