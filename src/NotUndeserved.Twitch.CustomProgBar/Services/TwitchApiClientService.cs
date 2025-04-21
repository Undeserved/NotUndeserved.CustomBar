using NotUndeserved.Twitch.CustomProgBar.Application.Common;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;
using System.Net.Http.Headers;
using System.Text.Json;

namespace NotUndeserved.Twitch.CustomProgBar.Services {
    public class TwitchApiClientService : ITwitchApiClientService {
        private readonly HttpClient _httpClient;
        private readonly ITokenManagerService _tokenManager;
        private readonly AppConfig _appConfig;

        public TwitchApiClientService(HttpClient httpClient, AppConfig appConfig, ITokenManagerService tokenManager) {
            _httpClient = httpClient;
            _appConfig = appConfig;
            _tokenManager = tokenManager;
        }

        public async Task<string?> GetUserIdByChannelNameAsync(string channelName) {
            var token = await _tokenManager.GetTokenAsync();
            if (token == null)
                return null;

            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token.AccessToken);
            _httpClient.DefaultRequestHeaders.Add("Client-Id", _appConfig.TwitchClientId);

            var response = await _httpClient.GetAsync($"https://api.twitch.tv/helix/users?login={channelName}");
            if (!response.IsSuccessStatusCode)
                return null;

            using var stream = await response.Content.ReadAsStreamAsync();
            var json = await JsonSerializer.DeserializeAsync<JsonElement>(stream);

            var user = json.GetProperty("data").EnumerateArray().FirstOrDefault();
            return user.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
        }
    }
}
