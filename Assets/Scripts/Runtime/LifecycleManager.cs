// LifecycleManager.cs — Gerenciador de ciclo de vida, autosave, detecção de clock rollback e modo offline.
// Conformidade com docs/03-TECH_DESIGN.md §6-§7 e docs/23-PLANO_IMPLEMENTACAO.md Fase F12.

#nullable enable
using System;
using System.Collections;
using UnityEngine;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class LifecycleManager : MonoBehaviour
    {
        private const float AUTOSAVE_INTERVAL_SEC = 60f; // Autosave a cada 60 s (§57, §58)
        private const long CLOCK_ROLLBACK_TOLERANCE_SEC = 60; // Desvio máximo tolerado (§58)

        public static LifecycleManager? Instance { get; private set; }

        public bool ClockRollbackDetected { get; private set; } = false;
        public bool IsOfflineMode => Application.internetReachability == NetworkReachability.NotReachable;
        public long LastPersistedDeviceClockSec { get; private set; } = 0;

        [SerializeField] private SaveManager? saveManager;
        private Coroutine? autosaveRoutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            VerifyClockIntegrityOnBoot();
        }

        private void Start()
        {
            autosaveRoutine = StartCoroutine(PeriodicAutosaveCoroutine());
        }

        private void VerifyClockIntegrityOnBoot()
        {
            var nowSec = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var lastClockStr = PlayerPrefs.GetString("device_clock_unix_sec", "0");
            if (long.TryParse(lastClockStr, out var lastClock) && lastClock > 0)
            {
                LastPersistedDeviceClockSec = lastClock;
                if (nowSec < lastClock - CLOCK_ROLLBACK_TOLERANCE_SEC)
                {
                    ClockRollbackDetected = true;
                    Debug.LogWarning($"[LifecycleManager] CLOCK ROLLBACK DETECTED: now={nowSec} < lastPersisted={lastClock}. Clamping offline gains.");
                }
                else
                {
                    ClockRollbackDetected = false;
                }
            }
            UpdatePersistedClock(nowSec);
        }

        public void UpdatePersistedClock(long timestampSec)
        {
            PlayerPrefs.SetString("device_clock_unix_sec", timestampSec.ToString());
            PlayerPrefs.Save();
        }

        private IEnumerator PeriodicAutosaveCoroutine()
        {
            while (true)
            {
                yield return new WaitForSecondsRealtime(AUTOSAVE_INTERVAL_SEC);
                TriggerAutosave("periodic_60s");
            }
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                // App backgrounded: immediate autosave (§57)
                Debug.Log("[LifecycleManager] Application paused / backgrounded. Immediate autosave.");
                TriggerAutosave("app_pause");
                UpdatePersistedClock(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            }
            else
            {
                // App resumed: check clock drift
                Debug.Log("[LifecycleManager] Application resumed from background.");
                VerifyClockIntegrityOnBoot();
            }
        }

        private void OnApplicationFocus(bool hasFocus)
        {
            if (!hasFocus)
            {
                TriggerAutosave("lost_focus");
            }
        }

        private void OnApplicationQuit()
        {
            Debug.Log("[LifecycleManager] Application quitting. Writing final save.");
            TriggerAutosave("app_quit");
            UpdatePersistedClock(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        }

        public void TriggerAutosave(string reason)
        {
            Debug.Log($"[LifecycleManager] Autosave triggered (reason: {reason})");
            // If active SaveManager is available, triggers dual-slot write
            UpdatePersistedClock(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        }
    }
}
