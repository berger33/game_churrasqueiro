// BuildPipeline.cs — Automated build pipeline for Android AAB/APK in Unity.
// Pinned for Unity 6 LTS, Target API 36, IL2CPP, ARM64, Linear color space.
// Follows specifications in docs/12-BUILD.md and docs/13-RELEASE.md.

#nullable enable
using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using Churrasco.Services;

namespace Churrasco.Editor
{
    public static class BuildPipeline
    {
        private const string PACKAGE_NAME = "com.studiobrasa.churrascomestredabrasa";
        private const string BUILD_OUTPUT_DIR = "build";
        private const string AAB_OUTPUT_FILE = "build/churrasco.aab";
        private const string APK_OUTPUT_FILE = "build/churrasco.apk";

        public const int TARGET_API_LEVEL = 36;
        public const int MIN_API_LEVEL = 26;
        public const int MAX_AAB_SIZE_MB = 90;

        [MenuItem("Churrasco/Build/Android AAB (Play Store Release)")]
        public static void BuildAndroidAab()
        {
            PerformBuild(isAab: true);
        }

        [MenuItem("Churrasco/Build/Android APK (Local Device Testing)")]
        public static void BuildAndroidApk()
        {
            PerformBuild(isAab: false);
        }

        public static BuildReport PerformBuild(bool isAab)
        {
            Debug.Log($"[BuildPipeline] Starting Android build (AAB: {isAab})...");

            // 1. Directory setup
            if (!Directory.Exists(BUILD_OUTPUT_DIR))
            {
                Directory.CreateDirectory(BUILD_OUTPUT_DIR);
            }

            // 2. Configure PlayerSettings for Google Play requirements (§1 of docs/12-BUILD.md)
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, PACKAGE_NAME);
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.colorSpace = ColorSpace.Linear;

            // Scripting & Architecture: IL2CPP + ARM64
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

            // Target & Min API Levels
            PlayerSettings.Android.minSdkVersion = (AndroidSdkVersions)MIN_API_LEVEL;
            PlayerSettings.Android.targetSdkVersion = (AndroidSdkVersions)TARGET_API_LEVEL;

            // 3. Configure App Bundle or APK
            EditorUserBuildSettings.buildAppBundle = isAab;
            EditorUserBuildSettings.androidBuildSubtarget = MobileTextureSubtarget.ASTC;

            // 4. Configure Keystore Signing from Environment Variables if present (§3)
            ConfigureSigning();

            // 5. Verify SecureConfig & AdMob IDs (§2, §93)
            VerifyConfigurationIntegrity();

            // 6. Gather Scenes
            var scenes = EditorBuildSettings.scenes
                .Where(s => s.enabled)
                .Select(s => s.path)
                .ToArray();

            if (scenes.Length == 0)
            {
                // Fallback to Main scene
                scenes = new[] { "Assets/Scenes/Main.unity" };
            }

            string outputPath = isAab ? AAB_OUTPUT_FILE : APK_OUTPUT_FILE;

            var buildPlayerOptions = new BuildPlayerOptions
            {
                scenes = scenes,
                locationPathName = outputPath,
                target = BuildTarget.Android,
                options = BuildOptions.None
            };

            var report = UnityEditor.BuildPipeline.BuildPlayer(buildPlayerOptions);
            LogBuildSummary(report, outputPath, isAab);

            return report;
        }

        private static void ConfigureSigning()
        {
            var keystorePath = Environment.GetEnvironmentVariable("CHURRASCO_KEYSTORE_PATH");
            var keystoreAlias = Environment.GetEnvironmentVariable("CHURRASCO_KEYSTORE_ALIAS");
            var keystorePass = Environment.GetEnvironmentVariable("CHURRASCO_KEYSTORE_PASSWORD");
            var keyPass = Environment.GetEnvironmentVariable("CHURRASCO_KEY_PASSWORD");

            if (!string.IsNullOrWhiteSpace(keystorePath) && File.Exists(keystorePath))
            {
                PlayerSettings.Android.useCustomKeystore = true;
                PlayerSettings.Android.keystoreName = keystorePath;
                PlayerSettings.Android.keyaliasName = keystoreAlias ?? "upload";
                PlayerSettings.Android.keystorePass = keystorePass ?? "";
                PlayerSettings.Android.keyaliasPass = keyPass ?? "";
                Debug.Log($"[BuildPipeline] Custom Keystore configured: {keystorePath} (Alias: {keystoreAlias})");
            }
            else
            {
                Debug.Log("[BuildPipeline] No external keystore specified. Using development debug keystore.");
            }
        }

        private static void VerifyConfigurationIntegrity()
        {
            var cfg = SecureConfig.Load();
            Debug.Log(cfg.SafeLog());

            if (!cfg.IsReleaseConfig)
            {
                Debug.LogWarning("[BuildPipeline] Building with public Google test AdMob IDs. Ensure credentials.json or env vars are populated for production release.");
            }
        }

        private static void LogBuildSummary(BuildReport report, string outputPath, bool isAab)
        {
            var summary = report.summary;
            if (summary.result == BuildResult.Succeeded)
            {
                var sizeMb = summary.totalSize / (1024f * 1024f);
                Debug.Log($"[BuildPipeline] Build Succeeded: {outputPath} ({sizeMb:F2} MB, duration: {summary.totalTime.TotalSeconds:F1} s)");

                if (isAab && sizeMb > MAX_AAB_SIZE_MB)
                {
                    Debug.LogWarning($"[BuildPipeline] WARNING: Output bundle size ({sizeMb:F2} MB) exceeds maximum budget of {MAX_AAB_SIZE_MB} MB (§7)");
                }
            }
            else if (summary.result == BuildResult.Failed)
            {
                Debug.LogError($"[BuildPipeline] Build Failed with {summary.totalErrors} errors.");
            }
        }
    }
}
