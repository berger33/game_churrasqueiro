// SecureConfig.cs — fonte única de segredos, sem hardcoded RELEASE ids.
// Ordem: StreamingAssets/credentials.json → env vars → baked defaults (test ids).
// Nunca loga valores reais; em editor mostra apenas prefixo. Falha em modo release
// se nenhum id real for encontrado e loga warning, não crash (especificação §93).

#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Churrasco.Services
{
    public sealed class SecureConfig
    {
        // Firebase properties
        public string FirebaseProjectId { get; private set; } = "churrasco-mestre-brasa-dev";
        public string FirebaseApiKey { get; private set; } = "AIzaSyTestPlaceholderKeyForDevelopmentOnly";
        public string FirebaseAppId { get; private set; } = "1:123456789012:android:abcdef0123456789";
        public string FirebaseMessagingSenderId { get; private set; } = "123456789012";
        public string FirebaseStorageBucket { get; private set; } = "churrasco-mestre-brasa-dev.appspot.com";

        // AdMob properties
        public string AndroidAppId { get; private set; } = "ca-app-pub-3940256099942544~3347511713"; // test
        public string IosAppId { get; private set; } = "ca-app-pub-3940256099942544~1458002511";
        public string RewardedUnitId { get; private set; } = "ca-app-pub-3940256099942544/5224354917";
        public string InterstitialUnitId { get; private set; } = "ca-app-pub-3940256099942544/1033173712";

        // Billing products
        public IReadOnlyList<string> BillingProductIds { get; private set; } = new[]
        {
            "brasa.starterpack.v1", "brasa.noads.v1", "brasa.embers.small.v1",
            "brasa.embers.medium.v1", "brasa.embers.large.v1", "brasa.pass.season.v1", "brasa.pass.bundle.v1"
        };

        // Privacy & UMP
        public bool UmpRequired { get; private set; } = true;
        public bool LgpdNoticeBR { get; private set; } = true;

        public bool IsReleaseConfig { get; private set; } = false;
        public string ConfigSource { get; private set; } = "baked_test_ids";

        private const string STREAMING_FILE = "credentials.json";
        private const string EXAMPLE_HINT = "Copie Assets/StreamingAssets/credentials.json.example → credentials.json";

        public static SecureConfig Load()
        {
            var cfg = new SecureConfig();
            // 1. StreamingAssets (build machine)
            var path = Path.Combine(Application.streamingAssetsPath, STREAMING_FILE);
            try
            {
                if (File.Exists(path))
                {
                    var json = File.ReadAllText(path);
                    var parsed = JsonUtility.FromJson<StreamingDto>(json);
                    if (parsed != null) cfg.ApplyStreaming(parsed, "streamingAssets/" + STREAMING_FILE);
                }
            }
            catch (Exception e) { Debug.LogWarning($"[SecureConfig] streaming read failed: {e.Message} ({EXAMPLE_HINT})"); }

            // 2. Env vars (CI / local .env via dotnet env)
            cfg.ApplyEnv();

            // 3. Validate: if still test ids in Release build, warn loud
#if !UNITY_EDITOR && !DEVELOPMENT_BUILD
            if (!cfg.IsReleaseConfig)
                Debug.LogWarning("[SecureConfig] RELEASE build usando AdMob TEST ids — configure credentials.json ou env vars (veja .env.example). Monetização não vai render.");
#endif
            return cfg;
        }

        private void ApplyStreaming(StreamingDto dto, string source)
        {
            if (dto.firebase != null)
            {
                if (!string.IsNullOrWhiteSpace(dto.firebase.project_id) && !dto.firebase.project_id.Contains("REPLACE"))
                    FirebaseProjectId = dto.firebase.project_id;
                if (!string.IsNullOrWhiteSpace(dto.firebase.api_key) && !dto.firebase.api_key.Contains("REPLACE"))
                    FirebaseApiKey = dto.firebase.api_key;
                if (!string.IsNullOrWhiteSpace(dto.firebase.app_id) && !dto.firebase.app_id.Contains("REPLACE"))
                    FirebaseAppId = dto.firebase.app_id;
                if (!string.IsNullOrWhiteSpace(dto.firebase.messaging_sender_id) && !dto.firebase.messaging_sender_id.Contains("REPLACE"))
                    FirebaseMessagingSenderId = dto.firebase.messaging_sender_id;
                if (!string.IsNullOrWhiteSpace(dto.firebase.storage_bucket) && !dto.firebase.storage_bucket.Contains("REPLACE"))
                    FirebaseStorageBucket = dto.firebase.storage_bucket;
            }

            if (dto.admob != null)
            {
                if (!string.IsNullOrWhiteSpace(dto.admob.androidAppId) && !dto.admob.androidAppId.Contains("REPLACE"))
                { AndroidAppId = dto.admob.androidAppId; IsReleaseConfig = true; ConfigSource = source; }
                if (!string.IsNullOrWhiteSpace(dto.admob.iosAppId) && !dto.admob.iosAppId.Contains("REPLACE"))
                    IosAppId = dto.admob.iosAppId;
                if (!string.IsNullOrWhiteSpace(dto.admob.rewarded) && !dto.admob.rewarded.Contains("REPLACE"))
                    RewardedUnitId = dto.admob.rewarded;
                if (!string.IsNullOrWhiteSpace(dto.admob.interstitial) && !dto.admob.interstitial.Contains("REPLACE"))
                    InterstitialUnitId = dto.admob.interstitial;
            }

            if (dto.billing?.products != null && dto.billing.products.Length > 0)
                BillingProductIds = dto.billing.products;

            if (dto.privacy != null)
            {
                UmpRequired = dto.privacy.umpRequired;
                LgpdNoticeBR = dto.privacy.lgpdNoticeBR;
            }
        }

        private void ApplyEnv()
        {
            string Env(string k) => Environment.GetEnvironmentVariable(k) ?? "";

            var fbProj = Env("CHURRASCO_FIREBASE_PROJECT_ID");
            if (!string.IsNullOrWhiteSpace(fbProj) && !fbProj.Contains("REPLACE")) FirebaseProjectId = fbProj;
            var fbKey = Env("CHURRASCO_FIREBASE_API_KEY");
            if (!string.IsNullOrWhiteSpace(fbKey) && !fbKey.Contains("REPLACE")) FirebaseApiKey = fbKey;
            var fbApp = Env("CHURRASCO_FIREBASE_APP_ID");
            if (!string.IsNullOrWhiteSpace(fbApp) && !fbApp.Contains("REPLACE")) FirebaseAppId = fbApp;

            var aApp = Env("CHURRASCO_ADMOB_ANDROID_APP_ID");
            if (!string.IsNullOrWhiteSpace(aApp) && !aApp.Contains("REPLACE")) { AndroidAppId = aApp; IsReleaseConfig = true; ConfigSource = "env"; }
            var r = Env("CHURRASCO_ADMOB_REWARDED_ID");
            if (!string.IsNullOrWhiteSpace(r) && !r.Contains("REPLACE")) RewardedUnitId = r;
            var inter = Env("CHURRASCO_ADMOB_INTERSTITIAL_ID");
            if (!string.IsNullOrWhiteSpace(inter) && !inter.Contains("REPLACE")) InterstitialUnitId = inter;
        }

        public string SafeLog()
        {
            string Mask(string s) => s.Length <= 12 ? "***" : s.Substring(0, 8) + "***" + s.Substring(s.Length - 4);
            return $"[SecureConfig] source={ConfigSource} release={IsReleaseConfig} fbProject={Mask(FirebaseProjectId)} androidAppId={Mask(AndroidAppId)} rewarded={Mask(RewardedUnitId)} products={BillingProductIds.Count}";
        }

        [Serializable]
        private class StreamingDto
        {
            public FirebaseDto firebase = null!;
            public AdMobDto admob = null!;
            public BillingDto billing = null!;
            public PrivacyDto privacy = null!;
        }

        [Serializable]
        private class FirebaseDto
        {
            public string project_id = "";
            public string api_key = "";
            public string app_id = "";
            public string messaging_sender_id = "";
            public string storage_bucket = "";
        }

        [Serializable]
        private class AdMobDto
        {
            public string androidAppId = "";
            public string iosAppId = "";
            public string rewarded = "";
            public string interstitial = "";
        }

        [Serializable]
        private class BillingDto
        {
            public string[] products = Array.Empty<string>();
        }

        [Serializable]
        private class PrivacyDto
        {
            public bool umpRequired = true;
            public bool lgpdNoticeBR = true;
        }
    }
}
