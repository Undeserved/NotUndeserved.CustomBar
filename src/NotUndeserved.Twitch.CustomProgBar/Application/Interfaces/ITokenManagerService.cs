using NotUndeserved.Twitch.CustomProgBar.Application.Models;

namespace NotUndeserved.Twitch.CustomProgBar.Application.Interfaces {
    public interface ITokenManagerService {
        event Action<TokenData>? TokenRefreshed;
        Task<TokenData?> GetTokenAsync();
        Task SaveTokenAsync(TokenData token);
        Task<TokenData?> GetTokenFromStorageAsync();

    }
}
