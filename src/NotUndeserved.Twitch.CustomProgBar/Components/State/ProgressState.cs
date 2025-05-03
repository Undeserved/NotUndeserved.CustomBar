using Microsoft.JSInterop;
using NotUndeserved.Twitch.CustomProgBar.Application.Common;
using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;

namespace NotUndeserved.Twitch.CustomProgBar.Components.State {
    public class ProgressState : IDisposable {
        private IJSRuntime? _js;
        private DotNetObjectReference<ProgressState>? _dotNetRef;

        public event Action? OnProgressUpdated;

        private const int DefaultSegments = 8;
        private int _segmentCount;
        private int _currentSegment;
        private const int _firstSegment = 1;

        public int Sections => _segmentCount;
        public int CurrentStep {
            get => _currentSegment;
            private set {
                _currentSegment = Math.Max(Math.Min(value, _segmentCount), _firstSegment);
                OnProgressUpdated?.Invoke();
            }
        }

        public ProgressState(IJSRuntime js) {
            _js = js;
        }

        public async Task InitialiseAsync() {

            var sectionsStr = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.CustomWidgetSegments);
            var fillStr = await _js.InvokeAsync<string>("localStorage.getItem", LocalResources.FillPercentage);

            if (!int.TryParse(sectionsStr, out int parsedSegments) || parsedSegments <= 2)
                parsedSegments = DefaultSegments;

            if (!int.TryParse(fillStr, out int parsedFill))
                parsedFill = 0;

            _segmentCount = parsedSegments;
            CurrentStep = parsedFill;

            await SyncToLocalStorage();

            _dotNetRef = DotNetObjectReference.Create(this);
            await _js.InvokeVoidAsync("progressSync.subscribeToStorageChanges", _dotNetRef);
        }

        [JSInvokable]
        public void OnStorageChanged(string key, string? newValue) {
            if (key == LocalResources.FillPercentage && int.TryParse(newValue, out int f)) {
                _currentSegment = f;
            } else if (key == LocalResources.CustomWidgetSegments && int.TryParse(newValue, out int s)) {
                _segmentCount = s;
                OnProgressUpdated?.Invoke();
            }
        }

        public async Task SetSectionsAsync(int value) {
            _segmentCount = value;
            await SyncToLocalStorage();
            OnProgressUpdated?.Invoke();
        }

        private async Task SyncToLocalStorage() {
            if (_js != null) {
                await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.FillPercentage, CurrentStep.ToString());
                await _js.InvokeVoidAsync("localStorage.setItem", LocalResources.CustomWidgetSegments, Sections.ToString());
            }
        }

        public void IncreaseProgress() {
            CurrentStep++;
            _ = SyncToLocalStorage();
        }

        public void DecreaseProgress() {
            CurrentStep--;
            _ = SyncToLocalStorage();
        }

        public void ResetProgress() {
            CurrentStep = _firstSegment;
            _ = SyncToLocalStorage();
        }

        public void Dispose() {
            _dotNetRef?.Dispose();
        }
    }
}
