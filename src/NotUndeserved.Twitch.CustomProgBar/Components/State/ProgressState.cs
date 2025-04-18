using NotUndeserved.Twitch.CustomProgBar.Application.Interfaces;

namespace NotUndeserved.Twitch.CustomProgBar.Components.State {
    public class ProgressState {
        public event Action? OnProgressUpdated;

        private IWidgetConfigService _configService;
        private const double MaxValue = 100;
        private const double MinValue = 0;
        private double _fillPercentage = 0;
        private double _step;
        public double Sections => _configService.Sections;
        public double FillPercentage {
            get => _fillPercentage;
            private set {
                _fillPercentage = Math.Max(Math.Min(value, MaxValue), MinValue);
                OnProgressUpdated?.Invoke();
            }
        }

        public ProgressState(IWidgetConfigService configService) {
            _configService = configService ?? throw new ArgumentNullException(nameof(configService));
            _step = MaxValue / Sections;
        }

        public void IncreaseProgress() {
            FillPercentage += _step;
        }

        public void DecreaseProgress() {
            FillPercentage -= _step;
        }

        public void ResetProgress() {
            FillPercentage = MinValue;
        }
    }
}
