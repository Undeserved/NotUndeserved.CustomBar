namespace NotUndeserved.Twitch.CustomProgBar.Application.Interfaces {
    public interface ITwitchApiClientService {
        Task<string?> GetUserIdByChannelNameAsync(string channelName);
    }
}
