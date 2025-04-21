namespace NotUndeserved.Twitch.CustomProgBar.Application.Dtos {
    public class TokenResponse {
        public string access_token { get; set; } = string.Empty;
        public string refresh_token { get; set; } = string.Empty;
        public int expires_in { get; set; }
    }
}
