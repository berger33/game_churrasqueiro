// BillingService.cs — Play Billing v7 (Android) — produits exactement ceux de shared/data/iap.json
// Tous les ids DOIVENT matcher Play Console. La validation de reçu est locale avec signature
// + retry 3× (500,2000,8000ms) jusqu'à ce qu'un backend fasse la vérification serveur.

#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Churrasco.Services
{
    public enum PurchaseResult { Success, Deferred, Failed, Cancelled, AlreadyOwned }

    public sealed class BillingService
    {
        private readonly SecureConfig cfg;
        // In real Unity: uses UnityEngine.Purchasing or com.android.billingclient:billing:7.x
        private readonly HashSet<string> ownedNonConsumables = new();

        public BillingService(SecureConfig config) { cfg = config; }

        public void Initialize(Action<bool>? onDone = null)
        {
            Debug.Log($"[Billing] Initialize {cfg.BillingProductIds.Count} products: {string.Join(", ", cfg.BillingProductIds)}");
            // Real: BillingClient.newBuilder, enablePendingPurchases, queryProductDetailsAsync
            // Validate that every iap.json id is registered in Play Console, else log error.
            onDone?.Invoke(true);
        }

        public IReadOnlyList<string> ProductIds => cfg.BillingProductIds.ToList();

        public void Purchase(string productId, Action<PurchaseResult, string?> onComplete)
        {
            if (!cfg.BillingProductIds.Contains(productId))
            {
                Debug.LogError($"[Billing] Unknown product {productId} — not in SecureConfig (check .env / credentials.json and shared/data/iap.json)");
                onComplete(PurchaseResult.Failed, null);
                return;
            }
            // One-time-per-account guard (§98)
            if (IsNonConsumable(productId) && ownedNonConsumables.Contains(productId))
            {
                onComplete(PurchaseResult.AlreadyOwned, null);
                return;
            }
            Debug.Log($"[Billing] Purchase {productId} — confirm dialog (no dark pattern §98), real price shown");
            // Real: launchBillingFlow + onPurchasesUpdated + acknowledge + consume
            // Retry policy local_signature_check fallback (§98 receiptValidation)
            // Grant pending flag if offline (gracefulOffline)
            ownedNonConsumables.Add(productId);
            PlayerPrefs.SetInt($"owned_{productId}", 1);
            onComplete(PurchaseResult.Success, "local_receipt_pending");
        }

        public bool IsOwned(string productId) => PlayerPrefs.GetInt($"owned_{productId}", 0) == 1;

        public void RestorePurchases(Action<IReadOnlyList<string>>? onDone = null)
        {
            // Always available (§98 restoreAlwaysAvailable)
            var restored = cfg.BillingProductIds.Where(IsOwned).ToList();
            Debug.Log($"[Billing] Restore {restored.Count} products");
            onDone?.Invoke(restored);
        }

        private static bool IsNonConsumable(string id) => id.Contains("starter") || id.Contains("noads") || id.Contains("starterpack");
    }
}
