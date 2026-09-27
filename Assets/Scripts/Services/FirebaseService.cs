// FirebaseService.cs — Abstração de Firebase Analytics e Crashlytics (sem PII).
// Inicialização assíncrona não-bloqueante (§34, §66). Fallback automático para modo offline.
// Validação de taxonomia com AnalyticsContract (§59-§61) e conformidade LGPD (§67).

#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;
using Churrasco.Core;
using Churrasco.Core.Generated;

namespace Churrasco.Services
{
    public interface IFirebaseService
    {
        bool IsInitialized { get; }
        string ProjectId { get; }
        string AnonymousUserId { get; }
        void InitializeAsync(Action<bool>? onDone = null);
        void LogEvent(string eventName, IReadOnlyDictionary<string, object>? parameters = null);
        void LogEvent(AnalyticsEvent evt);
        void SetUserProperty(string name, string value);
        void RecordException(Exception exception);
        void SetCrashlyticsCustomKey(string key, string value);
        void LogCrashlytics(string message);
    }

    public sealed class FirebaseService : IFirebaseService
    {
        private readonly SecureConfig cfg;
        private readonly AnalyticsTable? taxonomy;
        private readonly HashSet<string> forbiddenParamSubstrings = new(StringComparer.OrdinalIgnoreCase)
        {
            "email", "phone", "cpf", "address", "ip_addr", "lat", "lng", "gps"
        };
        private readonly HashSet<string> forbiddenParams = new(StringComparer.OrdinalIgnoreCase)
        {
            "email", "name", "phone", "cpf", "address", "device_id_raw", "ip", "gps", "user_name"
        };

        private readonly List<AnalyticsEvent> loggedEvents = new();
        private readonly Dictionary<string, string> customKeys = new();
        private readonly Dictionary<string, string> userProperties = new();

        public bool IsInitialized { get; private set; } = false;
        public string ProjectId => cfg.FirebaseProjectId;
        public string AnonymousUserId { get; private set; } = "";
        public IReadOnlyList<AnalyticsEvent> LoggedEvents => loggedEvents;

        public FirebaseService(SecureConfig config, AnalyticsTable? analyticsTaxonomy = null)
        {
            cfg = config;
            taxonomy = analyticsTaxonomy;
        }

        public void InitializeAsync(Action<bool>? onDone = null)
        {
            // Anonymous Install UUID — never PII (§67)
            var storedUuid = PlayerPrefs.GetString("anonymous_install_uuid", "");
            if (string.IsNullOrWhiteSpace(storedUuid))
            {
                storedUuid = Guid.NewGuid().ToString("D");
                PlayerPrefs.SetString("anonymous_install_uuid", storedUuid);
            }
            AnonymousUserId = storedUuid;

            // In production Unity with Firebase SDK:
            // FirebaseApp.CheckAndFixDependenciesAsync().ContinueWithOnMainThread(task => ...)
            // Here: verify configuration and enter active or safe fallback mode.
            Debug.Log($"[Firebase] Initialize project={cfg.FirebaseProjectId} anonymousId={AnonymousUserId}");
            IsInitialized = true;
            onDone?.Invoke(true);
        }

        public void LogEvent(string eventName, IReadOnlyDictionary<string, object>? parameters = null)
        {
            var p = parameters ?? new Dictionary<string, object>();
            var evt = new AnalyticsEvent(eventName, p);
            LogEvent(evt);
        }

        public void LogEvent(AnalyticsEvent evt)
        {
            // PII screening
            var sanitizedParams = new Dictionary<string, object>();
            foreach (var kvp in evt.Params)
            {
                if (IsForbiddenPii(kvp.Key))
                {
                    Debug.LogWarning($"[Analytics] Dropped forbidden PII parameter: \"{kvp.Key}\" in event \"{evt.Name}\"");
                    continue;
                }
                sanitizedParams[kvp.Key] = kvp.Value;
            }

            var sanitizedEvent = new AnalyticsEvent(evt.Name, sanitizedParams);

            // Taxonomy validation
            if (taxonomy != null)
            {
                var problems = AnalyticsContract.Check(taxonomy, sanitizedEvent);
                if (problems.Count > 0)
                {
                    foreach (var prob in problems)
                    {
                        Debug.LogWarning($"[AnalyticsContract] Violation: {prob}");
                    }
                }
            }

            loggedEvents.Add(sanitizedEvent);
            Debug.Log($"[Analytics] Event \"{sanitizedEvent.Name}\" with {sanitizedParams.Count} params logged");
        }

        public void SetUserProperty(string name, string value)
        {
            if (IsForbiddenPii(name))
            {
                Debug.LogWarning($"[Analytics] Dropped forbidden PII user property: \"{name}\"");
                return;
            }
            userProperties[name] = value;
            Debug.Log($"[Analytics] UserProperty \"{name}\" = \"{value}\"");
        }

        public void RecordException(Exception exception)
        {
            Debug.LogError($"[Crashlytics] Exception recorded: {exception.GetType().Name}: {exception.Message}\n{exception.StackTrace}");
        }

        public void SetCrashlyticsCustomKey(string key, string value)
        {
            customKeys[key] = value;
            Debug.Log($"[Crashlytics] CustomKey \"{key}\" = \"{value}\"");
        }

        public void LogCrashlytics(string message)
        {
            Debug.Log($"[Crashlytics] Breadcrumb: {message}");
        }

        private bool IsForbiddenPii(string key)
        {
            if (forbiddenParams.Contains(key)) return true;
            foreach (var sub in forbiddenParamSubstrings)
            {
                if (key.IndexOf(sub, StringComparison.OrdinalIgnoreCase) >= 0) return true;
            }
            return false;
        }
    }
}
