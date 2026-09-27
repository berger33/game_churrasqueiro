// LocalizationManager.cs — In-game localization lookup.
// Reads authored strings (pt-BR) and regional fallbacks (en-US, es-419).
#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Churrasco.Runtime
{
    public sealed class LocalizationManager : MonoBehaviour
    {
        private static LocalizationManager? instance;
        public static LocalizationManager Instance => instance ??= FindFirstObjectByType<LocalizationManager>();

        private readonly Dictionary<string, string> localizedStrings = new();
        private string currentLocale = "pt-BR";

        public string CurrentLocale => currentLocale;

        private void Awake()
        {
            if (instance != null && instance != this)
            {
                Destroy(gameObject);
                return;
            }
            instance = this;
            DontDestroyOnLoad(gameObject);
            LoadLocale(currentLocale);
        }

        public void LoadLocale(string locale)
        {
            currentLocale = locale;
            localizedStrings.Clear();

            // Load pt-BR base table
            var path = Path.Combine(Application.streamingAssetsPath, "l10n", $"{locale}.json");
            if (!File.Exists(path))
            {
                path = Path.Combine(Application.streamingAssetsPath, "l10n", "pt-BR.json");
            }

            if (File.Exists(path))
            {
                try
                {
                    var json = File.ReadAllText(path);
                    var dict = JsonUtility.FromJson<LocalizationData>(json);
                    if (dict?.strings != null)
                    {
                        foreach (var kvp in dict.strings)
                        {
                            localizedStrings[kvp.key] = kvp.value;
                        }
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[LocalizationManager] Failed loading locale {locale}: {ex.Message}");
                }
            }
        }

        public string Get(string key)
        {
            if (localizedStrings.TryGetValue(key, out var text))
            {
                return text;
            }
            return key;
        }

        public string Format(string key, params object[] args)
        {
            var raw = Get(key);
            try
            {
                return string.Format(raw, args);
            }
            catch
            {
                return raw;
            }
        }

        [Serializable]
        private class LocalizationData
        {
            public List<StringEntry> strings = new();
        }

        [Serializable]
        private class StringEntry
        {
            public string key = "";
            public string value = "";
        }
    }
}
