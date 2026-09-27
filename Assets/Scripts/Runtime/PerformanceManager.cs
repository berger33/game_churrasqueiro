// PerformanceManager.cs — Gerenciador de níveis de qualidade, auto-detecção e contenção de GC.
// Conformidade com shared/data/performance.json e docs/03-TECH_DESIGN.md §4.

#nullable enable
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Churrasco.Runtime
{
    public enum QualityTier { Low, Medium, High }

    public sealed class PerformanceManager : MonoBehaviour
    {
        private const int GC_BUDGET_BYTES = 1024; // max 1 KB/frame GC allocation during turns (§4)
        private const float THERMAL_THRESHOLD_FPS = 25f;
        private const float THERMAL_SUSTAINED_SEC = 5f;

        public static PerformanceManager? Instance { get; private set; }

        public QualityTier CurrentTier { get; private set; } = QualityTier.High;
        public float CurrentFps { get; private set; } = 60f;
        public long GcAllocThisFrame { get; private set; } = 0;
        public bool IsAutoDetecting { get; private set; } = false;

        private float sampleTimer = 0f;
        private int sampleFrameCount = 0;
        private float lowFpsTimer = 0f;
        private long lastGcAlloc = 0;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            LoadOrAutoDetectQuality();
        }

        private void Start()
        {
            if (PlayerPrefs.GetInt("quality_autodetected", 0) == 0)
            {
                StartCoroutine(AutoDetectQualityCoroutine());
            }
        }

        private void Update()
        {
            // FPS Tracking
            sampleFrameCount++;
            sampleTimer += Time.unscaledDeltaTime;
            if (sampleTimer >= 1.0f)
            {
                CurrentFps = sampleFrameCount / sampleTimer;
                sampleFrameCount = 0;
                sampleTimer = 0f;

                CheckThermalThrottling();
            }

            // GC Alloc Monitoring
            var currentAlloc = GC.GetTotalMemory(false);
            GcAllocThisFrame = Math.Max(0, currentAlloc - lastGcAlloc);
            lastGcAlloc = currentAlloc;

            if (GcAllocThisFrame > GC_BUDGET_BYTES && Debug.isDebugBuild)
            {
                // Warn about GC budget exceed during turn
                // Debug.LogWarning($"[Performance] GC Alloc of {GcAllocThisFrame} B exceeded budget of {GC_BUDGET_BYTES} B/frame");
            }
        }

        private void CheckThermalThrottling()
        {
            if (CurrentFps < THERMAL_THRESHOLD_FPS)
            {
                lowFpsTimer += 1.0f;
                if (lowFpsTimer >= THERMAL_SUSTAINED_SEC && CurrentTier > QualityTier.Low)
                {
                    Debug.LogWarning($"[Performance] Sustained low FPS (< {THERMAL_THRESHOLD_FPS} FPS for {THERMAL_SUSTAINED_SEC} s). Stepping down quality tier.");
                    StepDownQuality();
                    lowFpsTimer = 0f;
                }
            }
            else
            {
                lowFpsTimer = 0f;
            }
        }

        public void SetQualityTier(QualityTier tier)
        {
            CurrentTier = tier;
            ApplyQualitySettings(tier);
            PlayerPrefs.SetString("quality_tier", tier.ToString());
            PlayerPrefs.Save();
            Debug.Log($"[Performance] Quality tier set to: {tier}");
        }

        private void StepDownQuality()
        {
            if (CurrentTier == QualityTier.High) SetQualityTier(QualityTier.Medium);
            else if (CurrentTier == QualityTier.Medium) SetQualityTier(QualityTier.Low);
        }

        private void ApplyQualitySettings(QualityTier tier)
        {
            switch (tier)
            {
                case QualityTier.Low:
                    QualitySettings.resolutionScalingFixedDPIFactor = 0.75f;
                    QualitySettings.shadows = ShadowQuality.Disable;
                    QualitySettings.vSyncCount = 0;
                    Application.targetFrameRate = 30;
                    break;

                case QualityTier.Medium:
                    QualitySettings.resolutionScalingFixedDPIFactor = 0.90f;
                    QualitySettings.shadows = ShadowQuality.HardOnly;
                    QualitySettings.shadowDistance = 15f;
                    QualitySettings.vSyncCount = 0;
                    Application.targetFrameRate = 60;
                    break;

                case QualityTier.High:
                    QualitySettings.resolutionScalingFixedDPIFactor = 1.0f;
                    QualitySettings.shadows = ShadowQuality.All;
                    QualitySettings.shadowDistance = 30f;
                    QualitySettings.vSyncCount = 1;
                    Application.targetFrameRate = 60;
                    break;
            }
        }

        private void LoadOrAutoDetectQuality()
        {
            var savedTier = PlayerPrefs.GetString("quality_tier", "");
            if (Enum.TryParse<QualityTier>(savedTier, out var parsed))
            {
                CurrentTier = parsed;
                ApplyQualitySettings(parsed);
            }
            else
            {
                // Fallback to high while autodetect runs
                CurrentTier = QualityTier.High;
                ApplyQualitySettings(QualityTier.High);
            }
        }

        private IEnumerator AutoDetectQualityCoroutine()
        {
            IsAutoDetecting = true;
            Debug.Log("[Performance] Starting 3-second quality auto-detection sampling...");

            var elapsed = 0f;
            var frames = 0;

            while (elapsed < 3.0f)
            {
                yield return null;
                elapsed += Time.unscaledDeltaTime;
                frames++;
            }

            var measuredFps = frames / elapsed;
            Debug.Log($"[Performance] Auto-detect measured FPS: {measuredFps:F1}");

            // Hysteresis thresholds matching performance.json (fpsLowToMedium: 45, fpsMediumToHigh: 55, hysteresisFps: 5)
            QualityTier detected;
            if (measuredFps < 45f) detected = QualityTier.Low;
            else if (measuredFps < 55f) detected = QualityTier.Medium;
            else detected = QualityTier.High;

            SetQualityTier(detected);
            PlayerPrefs.SetInt("quality_autodetected", 1);
            PlayerPrefs.Save();
            IsAutoDetecting = false;
        }
    }
}
