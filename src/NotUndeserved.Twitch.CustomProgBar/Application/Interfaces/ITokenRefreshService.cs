namespace NotUndeserved.Twitch.CustomProgBar.Application.Interfaces {
    public interface ITokenRefreshService {
        event Func<string, Task>? OnTokenRefreshed;
        void Start();
        Task Refresh();
    }
}
