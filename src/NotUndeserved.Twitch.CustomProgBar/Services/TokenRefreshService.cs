using Microsoft.JSInterop;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;
using NotUndeserved.Twitch.CustomProgBar.Application.Models;

namespace NotUndeserved.Twitch.CustomProgBar.Services {
    public class TokenRefreshService : ITokenRefreshService, IAsyncDisposable {
        private readonly ITokenManagerService _tokenManager;
        private readonly IJSRuntime _js;
        private Timer? _timer;

        public event Func<string, Task>? OnTokenRefreshed;

        public TokenRefreshService(ITokenManagerService tokenManager, IJSRuntime js) {
            _tokenManager = tokenManager;
            _js = js;
        }

        public void Start() {
            _timer = new Timer(async _ => await Refresh(), null, TimeSpan.Zero, TimeSpan.FromMinutes(10));
        }

        public async Task Refresh() {
            var token = await _tokenManager.GetTokenAsync();
            if (!string.IsNullOrWhiteSpace(token?.AccessToken)) {
                if (OnTokenRefreshed is not null) {
                    await OnTokenRefreshed.Invoke(token.AccessToken);
                }
            }
        }

        public async ValueTask DisposeAsync() {
            if (_timer != null) {
                await _timer.DisposeAsync();
            }
        }
    }
}
