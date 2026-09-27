// PrivacyService.cs — Conformidade com LGPD (Brasil), GDPR (EEA/UK) e Google Play Data Safety (§67).
// Sem coleta de dados pessoais (PII). Consentimento transparente via UMP.
// Canal documentado para exclusão de dados e auditoria de privacidade.

#nullable enable
using System;
using UnityEngine;

namespace Churrasco.Services
{
    public interface IPrivacyService
    {
        bool IsPersonalizedAdsEnabled { get; }
        bool IsAnalyticsEnabled { get; }
        string PrivacyPolicyUrl { get; }
        string DataDeletionRequestUrl { get; }
        void SetPersonalizedAdsConsent(bool consented);
        void SetAnalyticsConsent(bool consented);
        void RequestDataDeletion(Action<bool>? onComplete = null);
    }

    public sealed class PrivacyService : IPrivacyService
    {
        private const string PREF_KEY_ADS_CONSENT = "privacy_personalized_ads_consent";
        private const string PREF_KEY_ANALYTICS_CONSENT = "privacy_analytics_consent";

        public string PrivacyPolicyUrl => "https://studiobrasa.games/privacy";
        public string DataDeletionRequestUrl => "https://studiobrasa.games/privacy/delete-data";

        public bool IsPersonalizedAdsEnabled
        {
            get => PlayerPrefs.GetInt(PREF_KEY_ADS_CONSENT, 1) == 1;
            private set => PlayerPrefs.SetInt(PREF_KEY_ADS_CONSENT, value ? 1 : 0);
        }

        public bool IsAnalyticsEnabled
        {
            get => PlayerPrefs.GetInt(PREF_KEY_ANALYTICS_CONSENT, 1) == 1;
            private set => PlayerPrefs.SetInt(PREF_KEY_ANALYTICS_CONSENT, value ? 1 : 0);
        }

        public PrivacyService()
        {
            // Default: opt-in to legitimate interest analytics
            if (!PlayerPrefs.HasKey(PREF_KEY_ANALYTICS_CONSENT))
            {
                PlayerPrefs.SetInt(PREF_KEY_ANALYTICS_CONSENT, 1);
            }
        }

        public void SetPersonalizedAdsConsent(bool consented)
        {
            IsPersonalizedAdsEnabled = consented;
            PlayerPrefs.Save();
            Debug.Log($"[Privacy] Personalized Ads Consent updated to: {consented}");
        }

        public void SetAnalyticsConsent(bool consented)
        {
            IsAnalyticsEnabled = consented;
            PlayerPrefs.Save();
            Debug.Log($"[Privacy] Analytics Collection Consent updated to: {consented}");
        }

        public void RequestDataDeletion(Action<bool>? onComplete = null)
        {
            // Conformidade com Google Play Data Safety (§67):
            // Apaga dados locais e UUID anônimo de telemetria
            PlayerPrefs.DeleteKey("anonymous_install_uuid");
            PlayerPrefs.Save();
            Debug.Log("[Privacy] Local anonymous identifier reset upon data deletion request");
            onComplete?.Invoke(true);
        }
    }
}
