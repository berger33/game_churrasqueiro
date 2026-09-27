// AccessibilitySettings.cs — Runtime accessibility options for mobile gameplay.
// Addresses color-independent doneness cues, reduced motion, and large touch targets.
#nullable enable
using System;
using UnityEngine;

namespace Churrasco.Runtime
{
    [Serializable]
    public sealed class AccessibilityOptions
    {
        public bool HighContrast { get; set; } = false;
        public bool ReducedMotion { get; set; } = false;
        public bool LargeTouchTargets { get; set; } = false;
        public bool SymbolDonenessCues { get; set; } = true; // Enables shapes/symbols alongside colors
    }

    public sealed class AccessibilitySettings : MonoBehaviour
    {
        private static AccessibilitySettings? instance;
        public static AccessibilitySettings Instance => instance ??= FindFirstObjectByType<AccessibilitySettings>();

        private AccessibilityOptions currentOptions = new();

        public AccessibilityOptions Options => currentOptions;

        public event Action<AccessibilityOptions>? OnOptionsChanged;

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            instance = this;
            DontDestroyOnLoad(gameObject);
            LoadPreferences();
        }

        public void SetHighContrast(bool enabled)
        {
            currentOptions.HighContrast = enabled;
            SavePreferences();
            OnOptionsChanged?.Invoke(currentOptions);
        }

        public void SetReducedMotion(bool enabled)
        {
            currentOptions.ReducedMotion = enabled;
            SavePreferences();
            OnOptionsChanged?.Invoke(currentOptions);
        }

        public void SetLargeTouchTargets(bool enabled)
        {
            currentOptions.LargeTouchTargets = enabled;
            SavePreferences();
            OnOptionsChanged?.Invoke(currentOptions);
        }

        public void SetSymbolDonenessCues(bool enabled)
        {
            currentOptions.SymbolDonenessCues = enabled;
            SavePreferences();
            OnOptionsChanged?.Invoke(currentOptions);
        }

        private void SavePreferences()
        {
            PlayerPrefs.SetInt("acc_high_contrast", currentOptions.HighContrast ? 1 : 0);
            PlayerPrefs.SetInt("acc_reduced_motion", currentOptions.ReducedMotion ? 1 : 0);
            PlayerPrefs.SetInt("acc_large_targets", currentOptions.LargeTouchTargets ? 1 : 0);
            PlayerPrefs.SetInt("acc_symbol_cues", currentOptions.SymbolDonenessCues ? 1 : 0);
            PlayerPrefs.Save();
        }

        private void LoadPreferences()
        {
            currentOptions.HighContrast = PlayerPrefs.GetInt("acc_high_contrast", 0) == 1;
            currentOptions.ReducedMotion = PlayerPrefs.GetInt("acc_reduced_motion", 0) == 1;
            currentOptions.LargeTouchTargets = PlayerPrefs.GetInt("acc_large_targets", 0) == 1;
            currentOptions.SymbolDonenessCues = PlayerPrefs.GetInt("acc_symbol_cues", 1) == 1;
        }

        /// <summary>
        /// Returns an accessible symbol name for doneness stages so players do not rely solely on color.
        /// </summary>
        public static string GetDonenessSymbol(int stageIndex)
        {
            return stageIndex switch
            {
                0 => "○", // Raw: empty circle
                1 => "◔", // Warming: quarter circle
                2 => "◑", // Half-cooked: half circle
                3 => "◕", // Almost done: three-quarters circle
                4 => "★", // Perfect: solid star
                5 => "▲", // Overdone: warning triangle
                6 => "▲▲", // Burning: double warning triangle
                7 => "✖", // Burned: cross/skull
                _ => "•"
            };
        }
    }
}
