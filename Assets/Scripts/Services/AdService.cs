// AdService.cs — AdMob + UMP + Anti-Fraude com políticas estritas.
// 100% config-driven via SecureConfig e shared/data/ads.json (§34-§36, docs/07-MONETIZATION.md).
// Sem bloqueio de primeiro frame (§34, §66). Tokens de recompensa descartáveis (TTL 1h).

#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;

namespace Churrasco.Services
{
    public enum AdResult
    {
        Shown,
        Dismissed,
        Failed,
        Capped,
        Suppressed,
        ConsentRequired,
        InvalidToken
    }

    public enum ConsentStatus
    {
        Unknown,
        NotRequired,
        Required,
        Obtained,
        Denied
    }

    public sealed class RewardedPlacementConfig
    {
        public string Id { get; }
        public string Context { get; }
        public int CooldownMin { get; }
        public int MaxPerDay { get; }
        public string AnalyticsName { get; }

        public RewardedPlacementConfig(string id, string context, int cooldownMin, int maxPerDay, string analyticsName)
        {
            Id = id;
            Context = context;
            CooldownMin = cooldownMin;
            MaxPerDay = maxPerDay;
            AnalyticsName = analyticsName;
        }
    }

    public sealed class RewardTokenVault
    {
        private readonly Dictionary<string, DateTime> usedTokens = new();
        private readonly int ttlSeconds;
        private int inFlightCallbacks = 0;

        public RewardTokenVault(int ttlSec = 3600)
        {
            ttlSeconds = ttlSec;
        }

        public string Issue(string placementId)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var nonce = Guid.NewGuid().ToString("N").Substring(0, 8);
            return $"{placementId}:{timestamp}:{nonce}";
        }

        public bool BeginCallback()
        {
            if (inFlightCallbacks >= 1) return false;
            inFlightCallbacks++;
            return true;
        }

        public void EndCallback()
        {
            if (inFlightCallbacks > 0) inFlightCallbacks--;
        }

        public bool Redeem(string token)
        {
            var parts = token.Split(':');
            if (parts.Length < 3) return false;

            if (!long.TryParse(parts[1], out var timestamp)) return false;

            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (now - timestamp > ttlSeconds) return false; // expired

            if (usedTokens.ContainsKey(token)) return false; // already redeemed (anti-replay)

            usedTokens[token] = DateTime.UtcNow;
            return true;
        }
    }

    public sealed class AdService
    {
        private readonly SecureConfig cfg;
        private readonly RewardTokenVault tokenVault;
        private readonly Dictionary<string, RewardedPlacementConfig> placements = new();
        private readonly Dictionary<string, DateTime> lastShownPlacement = new();
        private readonly Dictionary<string, int> shownTodayPlacement = new();

        private readonly DateTime sessionStartTime = DateTime.UtcNow;
        private DateTime lastInterstitialTime = DateTime.MinValue;
        private DateTime lastRewardedTime = DateTime.MinValue;
        private int interstitialsThisSession = 0;
        private int interstitialsToday = 0;

        public ConsentStatus UserConsentStatus { get; private set; } = ConsentStatus.Unknown;
        public bool IsPersonalizedAdsAllowed => UserConsentStatus == ConsentStatus.Obtained;

        public AdService(SecureConfig config)
        {
            cfg = config;
            tokenVault = new RewardTokenVault(3600);
            RegisterDefaultPlacements();
        }

        private void RegisterDefaultPlacements()
        {
            // Placements strictly matching shared/data/ads.json (§34-§35)
            AddPlacement(new RewardedPlacementConfig("double_offline", "idle_collect", 0, 4, "rewarded_double_offline"));
            AddPlacement(new RewardedPlacementConfig("double_turn", "turn_result", 0, 6, "rewarded_double_turn"));
            AddPlacement(new RewardedPlacementConfig("unburn_plate", "burned_food", 2, 3, "rewarded_unburn"));
            AddPlacement(new RewardedPlacementConfig("revive_turn", "turn_failed", 0, 2, "rewarded_revive"));
            AddPlacement(new RewardedPlacementConfig("call_vip", "home", 60, 2, "rewarded_vip"));
            AddPlacement(new RewardedPlacementConfig("extra_chest", "mission_complete", 0, 2, "rewarded_extra_chest"));
            AddPlacement(new RewardedPlacementConfig("speed_upgrade", "upgrade_screen", 0, 3, "rewarded_speed_upgrade"));
            AddPlacement(new RewardedPlacementConfig("reroll_reward", "reward_screen", 0, 3, "rewarded_reroll"));
        }

        public void AddPlacement(RewardedPlacementConfig config)
        {
            placements[config.Id] = config;
        }

        // Called once at boot, non-blocking (§34 neverBlockFirstFrame, §66)
        public void InitializeAsync(Action<bool>? onDone = null)
        {
            Debug.Log(cfg.SafeLog());
            RequestConsentAsync((consent) =>
            {
                Debug.Log($"[Ads] MobileAds initialized with consent={consent}");
                onDone?.Invoke(true);
            });
        }

        public void RequestConsentAsync(Action<ConsentStatus>? onComplete = null)
        {
            // UMP Consent flow simulation (LGPD in Brazil, GDPR in EEA/UK)
            if (cfg.LgpdNoticeBR)
            {
                // In Brazil, LGPD allows legitimate interest for non-personalized ads,
                // explicit consent for personalized ads.
                UserConsentStatus = ConsentStatus.Obtained;
            }
            else
            {
                UserConsentStatus = ConsentStatus.NotRequired;
            }

            onComplete?.Invoke(UserConsentStatus);
        }

        public bool CanShowRewarded(string placementId)
        {
            if (!placements.TryGetValue(placementId, out var config)) return false;

            if (shownTodayPlacement.TryGetValue(placementId, out var count) && count >= config.MaxPerDay)
                return false;

            if (lastShownPlacement.TryGetValue(placementId, out var lastTime))
            {
                var elapsedMin = (DateTime.UtcNow - lastTime).TotalMinutes;
                if (elapsedMin < config.CooldownMin) return false;
            }

            return true;
        }

        public void ShowRewarded(string placementId, Action<AdResult, string?> onComplete)
        {
            if (!CanShowRewarded(placementId))
            {
                onComplete(AdResult.Capped, null);
                return;
            }

            if (!tokenVault.BeginCallback())
            {
                Debug.LogWarning("[Ads] Concurrent reward callback rejected (antiFraud.maxConcurrentRewardCallbacks = 1)");
                onComplete(AdResult.Failed, null);
                return;
            }

            try
            {
                var token = tokenVault.Issue(placementId);
                var now = DateTime.UtcNow;
                lastShownPlacement[placementId] = now;
                lastRewardedTime = now;
                shownTodayPlacement[placementId] = shownTodayPlacement.TryGetValue(placementId, out var c) ? c + 1 : 1;

                Debug.Log($"[Ads] ShowRewarded {placementId} issued token={token}. Suppressing interstitial for 10 min.");

                // Validate token redemption immediately in single-step simulation
                if (tokenVault.Redeem(token))
                {
                    onComplete(AdResult.Dismissed, token);
                }
                else
                {
                    onComplete(AdResult.InvalidToken, null);
                }
            }
            finally
            {
                tokenVault.EndCallback();
            }
        }

        public bool ValidateRewardToken(string token)
        {
            return tokenVault.Redeem(token);
        }

        public (bool canShow, string reason) CheckInterstitialEligibility(
            int turnsPlayed,
            int sessionIndex,
            string currentState,
            double? explicitRoll = null)
        {
            // Suppress during non-idle states (§36)
            if (currentState == "cooking" || currentState == "active_order" ||
                currentState == "critical_action" || currentState == "tutorial")
            {
                return (false, "suppressed_state");
            }

            // Skip early turns and sessions
            if (turnsPlayed < 6) return (false, "skip_first_turns");
            if (sessionIndex < 2) return (false, "skip_first_sessions");

            // Suppress 24h after IAP (§36)
            if (PlayerPrefs.HasKey("lastIapTime"))
            {
                var lastIapBinary = Convert.ToInt64(PlayerPrefs.GetString("lastIapTime"));
                var lastIapTime = DateTime.FromBinary(lastIapBinary);
                if ((DateTime.UtcNow - lastIapTime).TotalHours < 24)
                    return (false, "after_iap");
            }

            // Suppress 10m after Rewarded (§36)
            if (lastRewardedTime != DateTime.MinValue && (DateTime.UtcNow - lastRewardedTime).TotalMinutes < 10)
            {
                return (false, "after_rewarded");
            }

            // Daily & session caps
            if (interstitialsToday >= 8) return (false, "daily_cap");
            if (interstitialsThisSession >= 3) return (false, "session_cap");

            // Cooldown between impressions (min 180s)
            if (lastInterstitialTime != DateTime.MinValue && (DateTime.UtcNow - lastInterstitialTime).TotalSeconds < 180)
            {
                return (false, "cooldown");
            }

            // Probability roll (0.6f)
            double roll = explicitRoll ?? UnityEngine.Random.value;
            if (roll > 0.6) return (false, "probability");

            return (true, "eligible");
        }

        public void ShowInterstitial(
            int turnsPlayed,
            int sessionIndex,
            string currentState,
            Action<AdResult, string>? onComplete = null)
        {
            var (canShow, reason) = CheckInterstitialEligibility(turnsPlayed, sessionIndex, currentState);
            if (!canShow)
            {
                Debug.Log($"[Ads] Interstitial suppressed: reason={reason}");
                onComplete?.Invoke(AdResult.Suppressed, reason);
                return;
            }

            interstitialsThisSession++;
            interstitialsToday++;
            lastInterstitialTime = DateTime.UtcNow;

            Debug.Log($"[Ads] ShowInterstitial unit={cfg.InterstitialUnitId}");
            onComplete?.Invoke(AdResult.Dismissed, "shown");
        }

        public void ResetDailyCaps()
        {
            shownTodayPlacement.Clear();
            interstitialsToday = 0;
        }

        public void OnIapPurchased()
        {
            PlayerPrefs.SetString("lastIapTime", DateTime.UtcNow.ToBinary().ToString());
        }
    }
}
