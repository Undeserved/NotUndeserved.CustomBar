namespace NotUndeserved.Twitch.CustomProgBar.Application.Common {
    public class AppConfig {
        //LEGAL LEGAL LEGAL
        //APPARENTLY EXPOSING THIS IS SAFE
        public string TwitchClientId { get; set; } = "";
        //LEGAL LEGAL LEGAL
        public string RedirectUri { get; set; } = "";
        public string ServerlessAuthWorker { get; set; } = "";
        public string TwitchAuthEndpoint { get; set; } = "";
    }
}
