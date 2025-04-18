namespace NotUndeserved.Twitch.CustomProgBar.Application.Interfaces {
    public interface IWidgetConfigService {
        int Sections { get; }
        Task LoadConfigurationAsync();
    }
}
