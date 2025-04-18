using Microsoft.JSInterop;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;
using System.Net.Http;

namespace NotUndeserved.Twitch.CustomProgBar.Services {
    public class WidgetConfigService : IWidgetConfigService {
        public int Sections { get; private set; }
        private readonly IJSRuntime _jsRuntime;

        public WidgetConfigService(IJSRuntime jsRuntime) {
            _jsRuntime = jsRuntime;
        }

        public async Task<int> GetSectionsAsync() {
            var sections = await _jsRuntime.InvokeAsync<string>("localStorage.getItem", "widget_segments");
            return int.TryParse(sections, out var result) ? result : 8;
        }

        public async Task LoadConfigurationAsync() {
            Sections = await GetSectionsAsync();
        }
    }
}
