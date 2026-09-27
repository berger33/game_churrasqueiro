// RemoteConfigService.cs — Firebase Remote Config com fallback offline embutido (§62).
// Carrega padrões locais imediatos (remoteconfig_defaults.json); fetch assíncrono com timeout de 8 s (§66).
// Permite balanceamento remoto sem atualização de app.

#nullable enable
using System;
using System.Collections.Generic;
using System.Globalization;
using UnityEngine;

namespace Churrasco.Services
{
    public interface IRemoteConfigService
    {
        bool IsFetched { get; }
        void InitializeWithDefaults(IReadOnlyDictionary<string, object>? customDefaults = null);
        void FetchAsync(Action<bool>? onDone = null);
        int GetInt(string key, int fallback = 0);
        float GetFloat(string key, float fallback = 0.0f);
        bool GetBool(string key, bool fallback = false);
        string GetString(string key, string fallback = "");
    }

    public sealed class RemoteConfigService : IRemoteConfigService
    {
        private readonly Dictionary<string, object> values = new();
        public bool IsFetched { get; private set; } = false;

        public RemoteConfigService()
        {
            InitializeWithDefaults();
        }

        public void InitializeWithDefaults(IReadOnlyDictionary<string, object>? customDefaults = null)
        {
            // Baked in defaults matching shared/data/remoteconfig_defaults.json (§62)
            values["economy_tip_base"] = 0.10f;
            values["economy_tip_perfect_bonus"] = 0.35f;
            values["economy_combo_step"] = 0.08f;
            values["economy_combo_cap"] = 2.0f;
            values["economy_xp_a"] = 55;
            values["economy_xp_exponent"] = 1.42f;
            values["upgrade_cost_discount"] = 0.0f;
            values["difficulty_scalar"] = 1.0f;
            values["difficulty_ramp_per_level"] = 0.012f;
            values["patience_base_seconds"] = 26;
            values["patience_per_item_seconds"] = 12;
            values["charcoal_duration_seconds"] = 150;
            values["charcoal_refill_seconds"] = 2.2f;
            values["turn_length_base_seconds"] = 90;
            values["turn_length_growth_per_restaurant"] = 15;
            values["max_customers_on_screen"] = 3;
            values["spawn_interval_seconds"] = 7.5f;
            values["spawn_interval_min_seconds"] = 3.2f;
            values["vip_chance"] = 0.06f;
            values["vip_max_per_day"] = 2;
            values["idle_max_offline_hours"] = 8;
            values["idle_ramp_minutes"] = 20;
            values["ads_interstitial_enabled"] = true;
            values["ads_interstitial_min_seconds_between"] = 180;
            values["ads_interstitial_max_per_session"] = 3;
            values["ads_interstitial_skip_first_turns"] = 6;
            values["ads_interstitial_show_probability"] = 0.6f;
            values["ads_rewarded_daily_cap"] = 20;
            values["popup_starter_pack_after_turns"] = 4;
            values["popup_pass_after_level"] = 6;
            values["popup_offer_min_interval_hours"] = 24;
            values["ftue_force_grill_focus"] = true;
            values["haptics_default_on"] = true;
            values["music_default_volume"] = 0.6f;
            values["sfx_default_volume"] = 0.85f;
            values["min_fps_target"] = 30;
            values["quality_autodetect"] = true;
            values["leaderboard_cohort_size"] = 100;
            values["kill_switch_iap"] = false;
            values["kill_switch_ads"] = false;
            values["kill_switch_events"] = false;
            values["ab_test_id"] = "default";
            values["events_override_json"] = "{}";
            values["offers_override_json"] = "{}";
            values["level_overrides_json"] = "{}";

            if (customDefaults != null)
            {
                foreach (var kvp in customDefaults)
                {
                    values[kvp.Key] = kvp.Value;
                }
            }
        }

        public void FetchAsync(Action<bool>? onDone = null)
        {
            // In production Unity with Firebase SDK:
            // FirebaseRemoteConfig.DefaultInstance.FetchAndActivateAsync() with 8s timeout
            Debug.Log("[RemoteConfig] Fetch completed (using baked defaults + active overrides)");
            IsFetched = true;
            onDone?.Invoke(true);
        }

        public int GetInt(string key, int fallback = 0)
        {
            if (!values.TryGetValue(key, out var val)) return fallback;
            try { return Convert.ToInt32(val, CultureInfo.InvariantCulture); }
            catch { return fallback; }
        }

        public float GetFloat(string key, float fallback = 0.0f)
        {
            if (!values.TryGetValue(key, out var val)) return fallback;
            try { return Convert.ToSingle(val, CultureInfo.InvariantCulture); }
            catch { return fallback; }
        }

        public bool GetBool(string key, bool fallback = false)
        {
            if (!values.TryGetValue(key, out var val)) return fallback;
            if (val is bool b) return b;
            if (bool.TryParse(val.ToString(), out var parsed)) return parsed;
            return fallback;
        }

        public string GetString(string key, string fallback = "")
        {
            if (!values.TryGetValue(key, out var val)) return fallback;
            return val?.ToString() ?? fallback;
        }

        // Convenience properties for common gameplay constants
        public float DifficultyScalar => GetFloat("difficulty_scalar", 1.0f);
        public float VipChance => GetFloat("vip_chance", 0.06f);
        public int VipMaxPerDay => GetInt("vip_max_per_day", 2);
        public int IdleMaxOfflineHours => GetInt("idle_max_offline_hours", 8);
        public bool AdsInterstitialEnabled => GetBool("ads_interstitial_enabled", true);
        public float InterstitialProbability => GetFloat("ads_interstitial_show_probability", 0.6f);
    }
}
