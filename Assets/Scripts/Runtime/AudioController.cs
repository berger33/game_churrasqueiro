// AudioController.cs — Sistema de áudio completo com barramentos, ducking e pool de 12 vozes.
// Conformidade rigorosa com Assets/Audio/manifest.json e docs/03-TECH_DESIGN.md §8.

#nullable enable
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Churrasco.Runtime
{
    public enum AudioTrack { Home, Gameplay, Result }
    public enum AudioCue
    {
        PlaceFood,
        FlipFood,
        Perfect,
        Good,
        Burned,
        Serve,
        Coin,
        CharcoalRefill,
        CharcoalLow,
        OrderIn,
        VipArrive,
        UiTap,
        UiBack,
        UiError,
        LevelUp,
        Combo5,
        Combo10,
        Combo15,
        Combo20
    }

    public sealed class AudioController : MonoBehaviour
    {
        private const int MAX_VOICES = 12; // Capped at 12 simultaneous voices (§8)
        private const float DUCK_VOLUME_RATIO = 0.5f; // -6 dB ducking during priority SFX

        [Header("Audio Sources")]
        [SerializeField] private AudioSource? musicSource;
        [SerializeField] private AudioSource? ambientSizzleSource;
        [SerializeField] private AudioSource? ambientCrackleSource;

        [Header("Music Clips")]
        [SerializeField] private AudioClip? musicHome;
        [SerializeField] private AudioClip? musicGameplay;
        [SerializeField] private AudioClip? musicResult;

        [Header("SFX Clips")]
        [SerializeField] private AudioClip[] placeClips = Array.Empty<AudioClip>();
        [SerializeField] private AudioClip[] flipClips = Array.Empty<AudioClip>();
        [SerializeField] private AudioClip[] perfectClips = Array.Empty<AudioClip>();
        [SerializeField] private AudioClip? goodClip;
        [SerializeField] private AudioClip? burnedClip;
        [SerializeField] private AudioClip? serveClip;
        [SerializeField] private AudioClip[] coinClips = Array.Empty<AudioClip>();
        [SerializeField] private AudioClip? charcoalLowClip;
        [SerializeField] private AudioClip? charcoalRefillClip;
        [SerializeField] private AudioClip? orderInClip;
        [SerializeField] private AudioClip? vipArriveClip;
        [SerializeField] private AudioClip? uiTapClip;
        [SerializeField] private AudioClip? uiBackClip;
        [SerializeField] private AudioClip? uiErrorClip;
        [SerializeField] private AudioClip? levelUpClip;
        [SerializeField] private AudioClip? combo5Clip;
        [SerializeField] private AudioClip? combo10Clip;
        [SerializeField] private AudioClip? combo15Clip;
        [SerializeField] private AudioClip? combo20Clip;

        // Audio Voice Pool (12 sources)
        private readonly List<AudioSource> sfxPool = new();
        private int lastFlipIndex = -1; // noRepeat guard
        private int coinStreak = 0; // pitchRun tracker
        private float lastCoinTime = 0f;

        // Volumes
        public float MasterVolume { get; private set; } = 1.0f;
        public float MusicVolume { get; private set; } = 0.6f; // remoteconfig_defaults.json: 0.6
        public float SfxVolume { get; private set; } = 0.85f;  // remoteconfig_defaults.json: 0.85

        private bool isDucking = false;
        private Coroutine? duckRoutine;

        private void Awake()
        {
            InitializeVoicePool();
            LoadVolumeSettings();
        }

        private void InitializeVoicePool()
        {
            for (int i = 0; i < MAX_VOICES; i++)
            {
                var go = new GameObject($"Voice_{i}");
                go.transform.SetParent(transform);
                var src = go.AddComponent<AudioSource>();
                src.playOnAwake = false;
                src.spatialBlend = 0f; // 2D UI/gameplay sound
                sfxPool.Add(src);
            }
        }

        private void LoadVolumeSettings()
        {
            MasterVolume = PlayerPrefs.GetFloat("audio_master_vol", 1.0f);
            MusicVolume = PlayerPrefs.GetFloat("audio_music_vol", 0.6f);
            SfxVolume = PlayerPrefs.GetFloat("audio_sfx_vol", 0.85f);
            ApplyVolumes();
        }

        public void SetMasterVolume(float vol)
        {
            MasterVolume = Mathf.Clamp01(vol);
            PlayerPrefs.SetFloat("audio_master_vol", MasterVolume);
            ApplyVolumes();
        }

        public void SetMusicVolume(float vol)
        {
            MusicVolume = Mathf.Clamp01(vol);
            PlayerPrefs.SetFloat("audio_music_vol", MusicVolume);
            ApplyVolumes();
        }

        public void SetSfxVolume(float vol)
        {
            SfxVolume = Mathf.Clamp01(vol);
            PlayerPrefs.SetFloat("audio_sfx_vol", SfxVolume);
            ApplyVolumes();
        }

        private void ApplyVolumes()
        {
            if (musicSource != null && !isDucking)
            {
                musicSource.volume = MasterVolume * MusicVolume;
            }
        }

        public void PlayMusic(AudioTrack track)
        {
            if (musicSource == null) return;

            AudioClip? clip = track switch
            {
                AudioTrack.Home => musicHome,
                AudioTrack.Gameplay => musicGameplay,
                AudioTrack.Result => musicResult,
                _ => null
            };

            if (clip != null && musicSource.clip != clip)
            {
                musicSource.Stop();
                musicSource.clip = clip;
                musicSource.loop = track != AudioTrack.Result;
                musicSource.volume = MasterVolume * MusicVolume;
                musicSource.Play();
            }
        }

        public void PlaySfx(AudioCue cue)
        {
            AudioClip? clip = null;
            float pitch = 1.0f;
            bool isPriority = false;

            switch (cue)
            {
                case AudioCue.PlaceFood:
                    clip = PickRandom(placeClips);
                    break;

                case AudioCue.FlipFood:
                    clip = PickFlipNoRepeat();
                    break;

                case AudioCue.Perfect:
                    clip = PickRandom(perfectClips);
                    break;

                case AudioCue.Good:
                    clip = goodClip;
                    break;

                case AudioCue.Burned:
                    clip = burnedClip;
                    break;

                case AudioCue.Serve:
                    clip = serveClip;
                    break;

                case AudioCue.Coin:
                    clip = PickRandom(coinClips);
                    pitch = CalculateCoinPitch();
                    break;

                case AudioCue.CharcoalLow:
                    clip = charcoalLowClip;
                    break;

                case AudioCue.CharcoalRefill:
                    clip = charcoalRefillClip;
                    break;

                case AudioCue.OrderIn:
                    clip = orderInClip;
                    break;

                case AudioCue.VipArrive:
                    clip = vipArriveClip;
                    isPriority = true;
                    break;

                case AudioCue.UiTap:
                    clip = uiTapClip;
                    break;

                case AudioCue.UiBack:
                    clip = uiBackClip;
                    break;

                case AudioCue.UiError:
                    clip = uiErrorClip;
                    break;

                case AudioCue.LevelUp:
                    clip = levelUpClip;
                    isPriority = true;
                    break;

                case AudioCue.Combo5:
                    clip = combo5Clip;
                    isPriority = true;
                    break;

                case AudioCue.Combo10:
                    clip = combo10Clip;
                    isPriority = true;
                    break;

                case AudioCue.Combo15:
                    clip = combo15Clip;
                    isPriority = true;
                    break;

                case AudioCue.Combo20:
                    clip = combo20Clip;
                    isPriority = true;
                    break;
            }

            if (clip != null)
            {
                PlayClipOnPooledVoice(clip, pitch);
                if (isPriority)
                {
                    TriggerDucking(clip.length);
                }
            }
        }

        private void PlayClipOnPooledVoice(AudioClip clip, float pitch)
        {
            var src = GetFreeVoice();
            if (src != null)
            {
                src.pitch = pitch;
                src.volume = MasterVolume * SfxVolume;
                src.PlayOneShot(clip);
            }
        }

        private AudioSource? GetFreeVoice()
        {
            foreach (var src in sfxPool)
            {
                if (!src.isPlaying) return src;
            }
            // All 12 voices busy: recycle first voice (voice stealing)
            return sfxPool.Count > 0 ? sfxPool[0] : null;
        }

        private AudioClip? PickFlipNoRepeat()
        {
            if (flipClips == null || flipClips.Length == 0) return null;
            if (flipClips.Length == 1) return flipClips[0];

            int idx;
            do
            {
                idx = UnityEngine.Random.Range(0, flipClips.Length);
            } while (idx == lastFlipIndex && flipClips.Length > 1);

            lastFlipIndex = idx;
            return flipClips[idx];
        }

        private float CalculateCoinPitch()
        {
            var now = Time.time;
            if (now - lastCoinTime < 1.5f)
            {
                coinStreak = Mathf.Min(coinStreak + 1, 8);
            }
            else
            {
                coinStreak = 0;
            }
            lastCoinTime = now;
            return 1.0f + (coinStreak * 0.05f); // Micro-pitch run: 1.00, 1.05, 1.10...
        }

        public void TriggerDucking(float durationSeconds)
        {
            if (musicSource == null) return;
            if (duckRoutine != null) StopCoroutine(duckRoutine);
            duckRoutine = StartCoroutine(DuckingCoroutine(durationSeconds));
        }

        private IEnumerator DuckingCoroutine(float duration)
        {
            if (musicSource == null) yield break;
            isDucking = true;
            musicSource.volume = MasterVolume * MusicVolume * DUCK_VOLUME_RATIO;

            yield return new WaitForSeconds(duration);

            musicSource.volume = MasterVolume * MusicVolume;
            isDucking = false;
            duckRoutine = null;
        }

        public void SetGrillSizzleVolume(float volume)
        {
            if (ambientSizzleSource != null)
            {
                var vol = Mathf.Clamp01(volume) * MasterVolume * SfxVolume;
                ambientSizzleSource.volume = vol;
                if (vol > 0.01f && !ambientSizzleSource.isPlaying) ambientSizzleSource.Play();
                else if (vol <= 0.01f && ambientSizzleSource.isPlaying) ambientSizzleSource.Stop();
            }
        }

        public void SetCharcoalCrackleVolume(float volume)
        {
            if (ambientCrackleSource != null)
            {
                var vol = Mathf.Clamp01(volume) * MasterVolume * SfxVolume;
                ambientCrackleSource.volume = vol;
                if (vol > 0.01f && !ambientCrackleSource.isPlaying) ambientCrackleSource.Play();
                else if (vol <= 0.01f && ambientCrackleSource.isPlaying) ambientCrackleSource.Stop();
            }
        }

        private static AudioClip? PickRandom(AudioClip[] clips)
        {
            if (clips == null || clips.Length == 0) return null;
            return clips[UnityEngine.Random.Range(0, clips.Length)];
        }
    }
}
