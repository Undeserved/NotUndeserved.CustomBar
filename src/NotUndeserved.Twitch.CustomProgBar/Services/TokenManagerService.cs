using Microsoft.JSInterop;
using NotUndeserved.Twitch.CustomProgBar.Application.Common;
using NotUndeserved.Twitch.CustomProgBar.Application.Dtos;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;
using NotUndeserved.Twitch.CustomProgBar.Application.Models;
using System.Net.Http.Json;
using System.Text.Json;

namespace NotUndeserved.Twitch.CustomProgBar.Services {
    public class TokenManagerService : ITokenManagerService {
        private readonly HttpClient _http;
        private readonly IJSRuntime _js;
        private readonly AppConfig _appConfig;

        private readonly TimeSpan RefreshWindow = TimeSpan.FromMinutes(10);

        public event Action<TokenData>? TokenRefreshed;

        public TokenManagerService(HttpClient http, IJSRuntime js, AppConfig appConfig) {
            _http = http;
            _js = js;
            _appConfig = appConfig;
        }

        public async Task<TokenData?> GetTokenAsync() {
            var tokenData = await GetTokenFromStorageAsync();
            if (tokenData == null) return null;

            if (DateTime.UtcNow > tokenData.ExpiresAt - RefreshWindow) {
                return await RefreshTokenAsync(tokenData.RefreshToken);
            }

            return tokenData;
        }

        public async Task SaveTokenAsync(TokenData token) {
            await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.TwitchAccessToken, token.AccessToken);
            await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.TwitchRefreshToken, token.RefreshToken);
            await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.TwitchTokenExpiresAt, ((DateTimeOffset)token.ExpiresAt).ToUnixTimeMilliseconds().ToString());
            string channelName = await GetChannelNameAsync(token.AccessToken) ?? string.Empty;
            await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.TwitchChannelName, channelName);
        }

        public async Task<TokenData?> GetTokenFromStorageAsync() {
            var accessToken = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.TwitchAccessToken);
            var refreshToken = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.TwitchRefreshToken);
            var expiresAtStr = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.TwitchTokenExpiresAt);

            if (string.IsNullOrWhiteSpace(accessToken) ||
                string.IsNullOrWhiteSpace(refreshToken) ||
                string.IsNullOrWhiteSpace(expiresAtStr)) return null;

            if (!long.TryParse(expiresAtStr, out var expiresAtMillis)) return null;

            var expiresAt = DateTimeOffset.FromUnixTimeMilliseconds(expiresAtMillis).UtcDateTime;

            return new TokenData {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresAt = expiresAt
            };
        }

        private async Task<TokenData?> RefreshTokenAsync(string refreshToken) {
            try {
                var response = await _http.PostAsJsonAsync("https://twitch-widget-token-request.undeservednull.workers.dev/refresh", new {
                    refresh_token = refreshToken
                });

                if (!response.IsSuccessStatusCode) return null;

                var result = await response.Content.ReadFromJsonAsync<TokenResponse>();
                if (result == null) return null;

                var newToken = new TokenData {
                    AccessToken = result.access_token,
                    RefreshToken = result.refresh_token,
                    ExpiresAt = DateTime.UtcNow.AddSeconds(result.expires_in)
                };

                await SaveTokenAsync(newToken);
                TokenRefreshed?.Invoke(newToken);
                return newToken;
            } catch {
                return null;
            }
        }

        private async Task<string> GetChannelNameAsync(string accessToken) {
            try {
                var request = new HttpRequestMessage(HttpMethod.Get, "https://api.twitch.tv/helix/users");
                request.Headers.Add("Authorization", $"Bearer {accessToken}");
                request.Headers.Add("Client-Id", _appConfig.TwitchClientId);

                var response = await _http.SendAsync(request);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);

                var login = doc.RootElement.GetProperty("data")[0].GetProperty("login").GetString();
                return login;
            } catch {
                return null;
            }
        }
    }
}
