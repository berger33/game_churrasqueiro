// FoodView.cs — Unity view component representing a food skewer on the grill or prep station.
// Renders doneness visual stages, flip prompt cues, progress indicator, and interaction handlers.
#nullable enable
using System;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class FoodView : MonoBehaviour, IPointerClickHandler, IBeginDragHandler, IDragHandler, IEndDragHandler
    {
        [Header("UI Elements")]
        [SerializeField] private Image? foodSpriteImage;
        [SerializeField] private Slider? donenessSlider;
        [SerializeField] private Image? donenessFillImage;
        [SerializeField] private GameObject? flipCueGlow;
        [SerializeField] private Image? seasoningBadge;

        [Header("Visual Config")]
        [SerializeField] private Sprite[]? donenessSprites; // 0=Raw, 1=Warming, 2=HalfCooked, 3=AlmostDone, 4=Perfect, 5=Overdone, 6=Burning, 7=Burned

        private ActiveFood? currentFood;
        private Canvas? rootCanvas;
        private RectTransform? rectTransform;
        private Vector3 originalLocalPosition;
        private Transform? originalParent;

        public event Action<string>? OnFlipRequested; // (foodId)
        public event Action<string, Vector2>? OnFoodDropped; // (foodId, screenPos)

        private void Awake()
        {
            rectTransform = GetComponent<RectTransform>();
            rootCanvas = GetComponentInParent<Canvas>();
        }

        public void Initialize(ActiveFood food)
        {
            currentFood = food;
            UpdateState(food);
        }

        public void UpdateState(ActiveFood food)
        {
            currentFood = food;

            // Doneness bar fill & color
            if (donenessSlider != null)
            {
                donenessSlider.maxValue = (float)food.TargetSec * 1.5f;
                donenessSlider.value = (float)food.ElapsedSec;
            }

            if (donenessFillImage != null)
            {
                switch (food.Stage)
                {
                    case DonenessStage.Raw:
                    case DonenessStage.Warming:
                        donenessFillImage.color = new Color(0.8f, 0.4f, 0.4f);
                        break;
                    case DonenessStage.HalfCooked:
                    case DonenessStage.AlmostDone:
                        donenessFillImage.color = new Color(0.9f, 0.7f, 0.2f);
                        break;
                    case DonenessStage.Perfect:
                        donenessFillImage.color = new Color(0.2f, 0.9f, 0.2f); // Sparkling green
                        break;
                    case DonenessStage.Overdone:
                    case DonenessStage.Burning:
                        donenessFillImage.color = new Color(0.9f, 0.3f, 0.1f);
                        break;
                    case DonenessStage.Burned:
                        donenessFillImage.color = new Color(0.2f, 0.2f, 0.2f); // Charcoal black
                        break;
                }
            }

            // Flip cue indicator for two-sided cuts
            if (flipCueGlow != null)
            {
                bool isFlipReady = food.FlipNeeded && !food.HasFlipped && food.FlipProgress >= 0.99;
                flipCueGlow.SetActive(isFlipReady);
            }

            // Swap sprite based on doneness stage if available
            if (foodSpriteImage != null && donenessSprites != null && donenessSprites.Length >= 8)
            {
                int stageIndex = Mathf.Clamp((int)food.Stage, 0, donenessSprites.Length - 1);
                foodSpriteImage.sprite = donenessSprites[stageIndex];
            }
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (currentFood == null) return;

            // Tap to flip if flip is needed
            if (currentFood.FlipNeeded && !currentFood.HasFlipped && currentFood.FlipProgress >= 0.99)
            {
                OnFlipRequested?.Invoke(currentFood.Id);
            }
        }

        public void OnBeginDrag(PointerEventData eventData)
        {
            originalParent = transform.parent;
            originalLocalPosition = transform.localPosition;

            if (rootCanvas != null)
            {
                transform.SetParent(rootCanvas.transform, true);
            }

            if (foodSpriteImage != null)
            {
                foodSpriteImage.raycastTarget = false;
            }
        }

        public void OnDrag(PointerEventData eventData)
        {
            if (rectTransform != null && rootCanvas != null)
            {
                rectTransform.anchoredPosition += eventData.delta / rootCanvas.scaleFactor;
            }
        }

        public void OnEndDrag(PointerEventData eventData)
        {
            if (foodSpriteImage != null)
            {
                foodSpriteImage.raycastTarget = true;
            }

            if (originalParent != null)
            {
                transform.SetParent(originalParent, true);
                transform.localPosition = originalLocalPosition;
            }

            if (currentFood != null)
            {
                OnFoodDropped?.Invoke(currentFood.Id, eventData.position);
            }
        }
    }
}
