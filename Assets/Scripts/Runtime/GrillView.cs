// GrillView.cs — Unity view component for the barbecue grill.
// Manages grill visual zones, skewer placement slots, fuel indicator, and smoke anchors.
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class GrillView : MonoBehaviour
    {
        [Header("Grill Visuals")]
        [SerializeField] private Image? grillBodyImage;
        [SerializeField] private RectTransform[] zoneContainers = Array.Empty<RectTransform>();
        [SerializeField] private GameObject? fourthZoneContainer;

        [Header("Charcoal UI")]
        [SerializeField] private Slider? charcoalSlider;
        [SerializeField] private Image? charcoalFillImage;
        [SerializeField] private Button? refillCharcoalButton;
        [SerializeField] private Animator? lowFuelAnimator;

        [Header("Prefabs & Anchors")]
        [SerializeField] private GameObject? foodViewPrefab;
        [SerializeField] private ParticleSystem? smokeVfx;
        [SerializeField] private ParticleSystem? embersVfx;

        private readonly Dictionary<string, FoodView> activeFoodViews = new();
        private TurnSimulation? currentSimulation;

        public event Action<int, int>? OnSlotTapped; // (zoneIndex, slotIndex)
        public event Action? OnRefillRequested;

        private void Awake()
        {
            if (refillCharcoalButton != null)
            {
                refillCharcoalButton.onClick.AddListener(() => OnRefillRequested?.Invoke());
            }
        }

        public void BindSimulation(TurnSimulation sim, bool hasFourthZone)
        {
            currentSimulation = sim;
            if (fourthZoneContainer != null)
            {
                fourthZoneContainer.SetActive(hasFourthZone);
            }
            ClearAllFood();
        }

        public void UpdateGrillDisplay(TurnState state)
        {
            if (charcoalSlider != null)
            {
                charcoalSlider.maxValue = (float)state.CharcoalMax;
                charcoalSlider.value = (float)state.CharcoalRemaining;
            }

            if (charcoalFillImage != null)
            {
                float ratio = (float)(state.CharcoalRemaining / Math.Max(1.0, state.CharcoalMax));
                if (ratio > 0.5f)
                    charcoalFillImage.color = new Color(0.2f, 0.8f, 0.2f); // Green
                else if (ratio > 0.2f)
                    charcoalFillImage.color = new Color(0.9f, 0.7f, 0.1f); // Orange
                else
                    charcoalFillImage.color = new Color(0.9f, 0.2f, 0.2f); // Red alert
            }

            if (lowFuelAnimator != null)
            {
                bool isLow = state.CharcoalRemaining / Math.Max(1.0, state.CharcoalMax) < 0.2;
                lowFuelAnimator.SetBool("IsLowFuel", isLow);
            }

            // Sync active foods
            var currentFoodIds = new HashSet<string>();
            foreach (var food in state.Foods)
            {
                currentFoodIds.Add(food.Id);
                if (!activeFoodViews.TryGetValue(food.Id, out var view))
                {
                    view = SpawnFoodView(food);
                    activeFoodViews[food.Id] = view;
                }
                view.UpdateState(food);
            }

            // Remove foods that are no longer on the grill
            var toRemove = new List<string>();
            foreach (var kvp in activeFoodViews)
            {
                if (!currentFoodIds.Contains(kvp.Key))
                {
                    toRemove.Add(kvp.Key);
                }
            }

            foreach (var id in toRemove)
            {
                if (activeFoodViews.TryGetValue(id, out var view))
                {
                    Destroy(view.gameObject);
                    activeFoodViews.Remove(id);
                }
            }

            // Modulate smoke/embers particle emission
            if (smokeVfx != null)
            {
                var emission = smokeVfx.emission;
                emission.rateOverTime = Mathf.Max(2f, state.Foods.Count * 4f);
            }
        }

        private FoodView SpawnFoodView(ActiveFood food)
        {
            RectTransform parent = transform as RectTransform ?? (RectTransform)transform;
            if (food.ZoneIndex >= 0 && food.ZoneIndex < zoneContainers.Length && zoneContainers[food.ZoneIndex] != null)
            {
                parent = zoneContainers[food.ZoneIndex];
            }

            GameObject go;
            if (foodViewPrefab != null)
            {
                go = Instantiate(foodViewPrefab, parent);
            }
            else
            {
                go = new GameObject($"Food_{food.Id}", typeof(RectTransform), typeof(Image), typeof(FoodView));
                go.transform.SetParent(parent, false);
            }

            var view = go.GetComponent<FoodView>();
            view.Initialize(food);
            return view;
        }

        public void ClearAllFood()
        {
            foreach (var view in activeFoodViews.Values)
            {
                if (view != null) Destroy(view.gameObject);
            }
            activeFoodViews.Clear();
        }
    }
}
