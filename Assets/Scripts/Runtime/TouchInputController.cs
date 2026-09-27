// TouchInputController.cs — Touch and pointer gesture router for mobile portrait gameplay.
// Handles tap-to-flip, drag skewer from tray to grill, zone-to-zone move, and grill-to-customer service.
#nullable enable
using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class TouchInputController : MonoBehaviour
    {
        [SerializeField] private TurnFlowController? turnController;
        [SerializeField] private Camera? gameplayCamera;
        [SerializeField] private RectTransform? dragGhostContainer;

        private void Awake()
        {
            if (gameplayCamera == null)
                gameplayCamera = Camera.main;
        }

        public void HandleFoodTap(string foodInstanceId)
        {
            if (turnController == null) return;
            turnController.FlipFood(foodInstanceId);
        }

        public void HandleFoodPlaced(string foodId, int targetZone, int targetSlot)
        {
            if (turnController == null) return;
            turnController.PlaceFood(foodId, targetZone, targetSlot);
        }

        public void HandleFoodServed(string customerId, string foodInstanceId)
        {
            if (turnController == null) return;
            turnController.ServeCustomer(customerId, foodInstanceId);
        }
    }
}
