namespace NotUndeserved.Twitch.CustomProgBar.Application.Dtos {
    public class SettingsDto {
        public string AccessToken { get; set; } = "";
        public string RefreshToken { get; set; } = "";
        public string ExpiresAt { get; set; } = "";
        public string ChannelName { get; set; } = "";
        public string CustomBarUrl { get; set; } = "";
        public string CustomDialUrl { get; set; } = "";
        public string BarSegments { get; set; } = "";
        public string RedemptionIncrease { get; set; } = "";
        public string RedemptionDecrease { get; set; } = "";
        public string RedemptionReset { get; set; } = "";
    }
}
