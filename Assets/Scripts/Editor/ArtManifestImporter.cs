// ArtManifestImporter.cs — Configures Unity TextureImporters according to Assets/Art/sprites.manifest.json.
// Ensures 244 runtime sprites are imported with correct pivots, sprite modes, and compression.
#nullable enable
#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Churrasco.Editor
{
    public sealed class ArtManifestImporter : AssetPostprocessor
    {
        private const string MANIFEST_PATH = "Assets/Art/sprites.manifest.json";

        [Serializable]
        public class ManifestData
        {
            public Dictionary<string, SpriteEntry> sprites = new();
        }

        [Serializable]
        public class SpriteEntry
        {
            public string file = "";
            public int w;
            public int h;
            public float[] pivot = new float[] { 0.5f, 0.5f };
            public string category = "";
            public string batch = "";
        }

        private static Dictionary<string, SpriteEntry>? cachedEntries;

        public static Dictionary<string, SpriteEntry> GetEntries()
        {
            if (cachedEntries != null) return cachedEntries;

            cachedEntries = new Dictionary<string, SpriteEntry>();
            if (!File.Exists(MANIFEST_PATH)) return cachedEntries;

            try
            {
                var json = File.ReadAllText(MANIFEST_PATH);
                // Simple parser wrapper for Dictionary deserialization
                var manifest = JsonUtility.FromJson<ManifestData>(json);
                if (manifest?.sprites != null)
                {
                    cachedEntries = manifest.sprites;
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[ArtManifestImporter] Error reading manifest: {ex.Message}");
            }

            return cachedEntries;
        }

        private void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith("Assets/Art/")) return;

            var entries = GetEntries();
            SpriteEntry? matchingEntry = null;

            foreach (var kvp in entries)
            {
                if (string.Equals(kvp.Value.file, assetPath, StringComparison.OrdinalIgnoreCase))
                {
                    matchingEntry = kvp.Value;
                    break;
                }
            }

            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.alphaIsTransparency = true;
            importer.mipmapEnabled = false;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.filterMode = FilterMode.Bilinear;

            if (matchingEntry != null && matchingEntry.pivot != null && matchingEntry.pivot.Length >= 2)
            {
                importer.spritePivot = new Vector2(matchingEntry.pivot[0], matchingEntry.pivot[1]);
                importer.spriteAlignment = (int)SpriteAlignment.Custom;

                // Set atlas packing tag by category
                if (!string.IsNullOrEmpty(matchingEntry.category))
                {
                    importer.spritePackingTag = $"atlas_{matchingEntry.category}";
                }
            }

            // Android ASTC optimization
            var androidSettings = importer.GetPlatformTextureSettings("Android");
            androidSettings.overridden = true;
            androidSettings.format = TextureImporterFormat.ASTC_6x6;
            androidSettings.compressionQuality = 50;
            importer.SetPlatformTextureSettings(androidSettings);
        }

        [MenuItem("Churrasco/Art/Sync All Manifest Sprites")]
        public static void SyncAllManifestSprites()
        {
            var entries = GetEntries();
            int count = 0;
            foreach (var kvp in entries)
            {
                var path = kvp.Value.file;
                if (File.Exists(path))
                {
                    AssetDatabase.ImportAsset(path, ImportAssetOptions.ForceUpdate);
                    count++;
                }
            }
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[ArtManifestImporter] Successfully synced {count} sprites from manifest.");
        }
    }
}
#endif
