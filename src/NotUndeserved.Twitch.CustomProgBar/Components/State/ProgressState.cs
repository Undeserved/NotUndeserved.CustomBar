using Microsoft.JSInterop;
using NotUndeserved.Twitch.CustomProgBar.Application.Common;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;

namespace NotUndeserved.Twitch.CustomProgBar.Components.State {
    public class ProgressState : IDisposable {
        private IJSRuntime? _js;
        private DotNetObjectReference<ProgressState>? _dotNetRef;

        public event Action? OnProgressUpdated;

        private const double DefaultSegments = 8;
        private const double MaxValue = 100;
        private const double MinValue = 0;
        private double _fillPercentage = 0;
        private double _step;
        public double Sections { get; private set; }
        public double FillPercentage {
            get => _fillPercentage;
            private set {
                _fillPercentage = Math.Max(Math.Min(value, MaxValue), MinValue);
                OnProgressUpdated?.Invoke();
            }
        }

        public ProgressState(IJSRuntime js) {
            _js = js;
        }

        public async Task InitialiseAsync() {

            var sectionsStr = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.CustomWidgetSegments);
            var fillStr = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.FillPercentage);

            if (!double.TryParse(sectionsStr, out double parsedSegments) || parsedSegments <= 0)
                parsedSegments = DefaultSegments;

            if (!double.TryParse(fillStr, out double parsedFill))
                parsedFill = 0;

            Sections = parsedSegments;
            FillPercentage = parsedFill;
            _step = MaxValue / Sections;

            await SyncToLocalStorage();

            _dotNetRef = DotNetObjectReference.Create(this);
            await _js.InvokeVoidAsync("progressSync.subscribeToStorageChanges", _dotNetRef);
        }

        [JSInvokable]
        public void OnStorageChanged(string key, string? newValue) {
            if (key == LocalResources.FillPercentage && double.TryParse(newValue, out var f)) {
                FillPercentage = f;
            } else if (key == LocalResources.CustomWidgetSegments && double.TryParse(newValue, out var s)) {
                Sections = s;
                _step = MaxValue / Sections;
                OnProgressUpdated?.Invoke();
            }
        }

        public async Task SetSectionsAsync(int value) {
            Sections = value;
            await SyncToLocalStorage();
            OnProgressUpdated?.Invoke();
        }

        private async Task SyncToLocalStorage() {
            if (_js != null) {
                await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.FillPercentage, FillPercentage.ToString());
                await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.CustomWidgetSegments, Sections.ToString());
            }
        }

        public void IncreaseProgress() {
            FillPercentage += _step;
            _ = SyncToLocalStorage();
        }

        public void DecreaseProgress() {
            FillPercentage -= _step;
            _ = SyncToLocalStorage();
        }

        public void ResetProgress() {
            FillPercentage = MinValue;
            _ = SyncToLocalStorage();
        }

        public void Dispose() {
            _dotNetRef?.Dispose();
        }
    }
}
