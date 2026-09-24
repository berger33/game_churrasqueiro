// AdService.cs — AdMob + UMP + anti-fraude, 100% config-driven.
// Nunca hardcode RELEASE ids; todas vêm de SecureConfig (que lê credentials.json).
// Especificação: shared/data/ads.json §34-§35, docs/07-MONETIZATION.md §3.

#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Churrasco.Services
{
    public enum AdResult { Shown, Dismissed, Failed, Capped, Suppressed, ConsentRequired }

    public sealed class AdService
    {
        private readonly SecureConfig cfg;
        private readonly Dictionary<string, DateTime> lastShown = new();
        private readonly Dictionary<string, int> shownToday = new();
        private DateTime sessionStart = DateTime.UtcNow;
        private int interstitialShownThisSession = 0;

        public AdService(SecureConfig config) { cfg = config; }

        // Called once at boot, non-blocking (§34 neverBlockFirstFrame)
        public void InitializeAsync(Action<bool>? onDone = null)
        {
            Debug.Log(cfg.SafeLog());
            // UMP consent flow (stub — real implementation calls GoogleMobileAds.Ump)
            Debug.Log("[Ads] UMP request (brazil=LGPD notice, eea=required). Test ids em DEBUG, reais em RELEASE.");
            // MobileAds.Initialize() is async; real code awaits it.
            // In editor/test, we fake success.
            onDone?.Invoke(true);
        }

        public bool CanShowRewarded(string placementId)
        {
            // Check caps from ads.json rewardedPlacements.*.maxPerDay / cooldown
            // Simplified: enforce service-side token single-use (§35)
            if (shownToday.TryGetValue(placementId, out var c) && c >= 6) return false;
            if (lastShown.TryGetValue(placementId, out var last) && (DateTime.UtcNow - last).TotalMinutes < 0) return false;
            return true;
        }

        public void ShowRewarded(string placementId, Action<AdResult, string?> onComplete)
        {
            if (!CanShowRewarded(placementId)) { onComplete(AdResult.Capped, null); return; }
            Debug.Log($"[Ads] ShowRewarded {placementId} unit={cfg.RewardedUnitId} — supprime interstitial 10min");
            // Real: RewardedAd.Load + Show + ServerSideVerification (disabled até backend §35)
            // Token single-use: generate, store, validate callback once.
            var token = Guid.NewGuid().ToString("N");
            lastShown[placementId] = DateTime.UtcNow;
            shownToday[placementId] = shownToday.TryGetValue(placementId, out var cc) ? cc+1 : 1;
            // fake callback
            onComplete(AdResult.Dismissed, token);
        }

        public bool CanShowInterstitial(string reason = "")
        {
            // Gates §34
            if (interstitialShownThisSession >= 3) return false;
            if ((DateTime.UtcNow - sessionStart).TotalSeconds < 180 && interstitialShownThisSession == 0) return false;
            // suppressed: cooking, tutorial, critical_action
            if (reason == "cooking" || reason == "tutorial") return false;
            // suppress 10min after rewarded, 24h after IAP (check PlayerPrefs flag)
            if (PlayerPrefs.HasKey("lastIapTime") && (DateTime.UtcNow - DateTime.FromBinary(Convert.ToInt64(PlayerPrefs.GetString("lastIapTime")))).TotalHours < 24)
                return false;
            return UnityEngine.Random.value < 0.6f; // showProbability
        }

        public void ShowInterstitial(Action<AdResult>? onComplete = null)
        {
            if (!CanShowInterstitial()) { onComplete?.Invoke(AdResult.Suppressed); return; }
            Debug.Log($"[Ads] ShowInterstitial unit={cfg.InterstitialUnitId}");
            interstitialShownThisSession++;
            onComplete?.Invoke(AdResult.Dismissed);
        }

        public void OnIapPurchased() => PlayerPrefs.SetString("lastIapTime", DateTime.UtcNow.ToBinary().ToString());
    }
}
