﻿namespace NotUndeserved.Twitch.CustomProgBar.Application.Models {
    public class TokenData {
        public string AccessToken { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }
}
