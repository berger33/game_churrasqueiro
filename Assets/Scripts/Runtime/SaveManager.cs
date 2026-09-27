// SaveManager.cs — Persistent storage manager for Unity.
// Manages primary and backup save slots with IEEE 802.3 CRC32 verification and schema migrations.
#nullable enable
using System;
using System.IO;
using UnityEngine;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class SaveManager : MonoBehaviour
    {
        private const string PRIMARY_FILE = "savegame.dat";
        private const string BACKUP_FILE = "savegame.bak";

        private string PrimaryPath => Path.Combine(Application.persistentDataPath, PRIMARY_FILE);
        private string BackupPath => Path.Combine(Application.persistentDataPath, BACKUP_FILE);

        public bool Save(SaveEnvelope envelope)
        {
            try
            {
                var json = SaveSystem.SerializeEnvelope(envelope);
                var primary = PrimaryPath;
                var backup = BackupPath;

                // Rotate current primary to backup if it exists
                if (File.Exists(primary))
                {
                    File.Copy(primary, backup, true);
                }

                File.WriteAllText(primary, json);
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SaveManager] Failed to write save file: {ex.Message}");
                return false;
            }
        }

        public SaveEnvelope? Load()
        {
            // Attempt primary slot first
            var env = TryLoadFile(PrimaryPath);
            if (env != null) return env;

            // Fallback to backup slot
            Debug.LogWarning("[SaveManager] Primary save failed or missing; attempting backup slot.");
            env = TryLoadFile(BackupPath);
            if (env != null) return env;

            Debug.Log("[SaveManager] No valid save found; generating clean initial state.");
            return null;
        }

        private SaveEnvelope? TryLoadFile(string path)
        {
            if (!File.Exists(path)) return null;

            try
            {
                var json = File.ReadAllText(path);
                var result = SaveSystem.VerifyEnvelope(json);
                if (result.IsValid && result.Envelope != null)
                {
                    return result.Envelope;
                }
                Debug.LogWarning($"[SaveManager] Corrupt save at {path}: {result.ErrorMessage}");
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SaveManager] Error reading {path}: {ex.Message}");
            }

            return null;
        }
    }
}
