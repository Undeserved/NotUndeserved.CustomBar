namespace NotUndeserved.Twitch.CustomProgBar.Application.Common {
    public class AppConfig {
        //LEGAL LEGAL LEGAL
        //APPARENTLY EXPOSING THIS IS SAFE
        public string TwitchClientId { get; set; } = default;
        //LEGAL LEGAL LEGAL
        public string RedirectUri { get; set; } = default;
        public string ServerlessAuthWorker { get; set; } = default;
        public string TwitchAuthEndpoint { get; set; } = default;
    }
}
