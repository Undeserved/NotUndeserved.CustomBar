namespace NotUndeserved.Twitch.CustomProgBar.Application.Dtos {
    public class OAuthTokenDto {
        public string AccessToken { get; set; } = "";
        public string RefreshToken { get; set; } = "";
        public string ExpiresAt { get; set; } = "";
        public string ChannelName { get; set; } = "";
    }
}
