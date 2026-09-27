// CustomerCardView.cs — Unity view component for waiting customers.
// Shows portrait, patience timer bar, order bubbles, VIP crown/border, and reaction cues.
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class CustomerCardView : MonoBehaviour
    {
        [Header("Customer Visuals")]
        [SerializeField] private Image? portraitImage;
        [SerializeField] private TMP_Text? customerNameText;
        [SerializeField] private GameObject? vipCrownBadge;
        [SerializeField] private Image? vipBorderGlow;

        [Header("Patience Bar")]
        [SerializeField] private Slider? patienceSlider;
        [SerializeField] private Image? patienceFillImage;

        [Header("Order Bubbles")]
        [SerializeField] private RectTransform? orderItemsContainer;
        [SerializeField] private GameObject? orderItemIconPrefab;

        [Header("Reactions")]
        [SerializeField] private GameObject? happyReactionIcon;
        [SerializeField] private GameObject? angryReactionIcon;

        private CustomerState? currentCustomer;
        private readonly List<GameObject> spawnedOrderIcons = new();

        public string? CustomerId => currentCustomer?.Id;

        public void Initialize(CustomerState customer, Sprite? portraitSprite = null)
        {
            currentCustomer = customer;

            if (customerNameText != null)
                customerNameText.text = customer.ArchetypeId;

            if (portraitImage != null && portraitSprite != null)
                portraitImage.sprite = portraitSprite;

            if (vipCrownBadge != null)
                vipCrownBadge.SetActive(customer.IsVip);

            if (vipBorderGlow != null)
                vipBorderGlow.gameObject.SetActive(customer.IsVip);

            RebuildOrderIcons(customer);
            UpdatePatience(customer);
        }

        public void UpdateCustomer(CustomerState customer)
        {
            currentCustomer = customer;
            UpdatePatience(customer);
        }

        private void UpdatePatience(CustomerState customer)
        {
            if (patienceSlider != null)
            {
                patienceSlider.maxValue = (float)customer.MaxPatience;
                patienceSlider.value = (float)customer.Patience;
            }

            if (patienceFillImage != null)
            {
                float ratio = (float)(customer.Patience / Math.Max(1.0, customer.MaxPatience));
                if (ratio > 0.5f)
                    patienceFillImage.color = new Color(0.2f, 0.8f, 0.2f);
                else if (ratio > 0.25f)
                    patienceFillImage.color = new Color(0.9f, 0.7f, 0.1f);
                else
                    patienceFillImage.color = new Color(0.9f, 0.2f, 0.2f); // Critical impatience
            }
        }

        private void RebuildOrderIcons(CustomerState customer)
        {
            foreach (var icon in spawnedOrderIcons)
            {
                if (icon != null) Destroy(icon);
            }
            spawnedOrderIcons.Clear();

            if (orderItemsContainer == null) return;

            foreach (var item in customer.Order)
            {
                GameObject iconGo;
                if (orderItemIconPrefab != null)
                {
                    iconGo = Instantiate(orderItemIconPrefab, orderItemsContainer);
                }
                else
                {
                    iconGo = new GameObject($"Order_{item.FoodId}", typeof(RectTransform), typeof(Image));
                    iconGo.transform.SetParent(orderItemsContainer, false);
                }
                spawnedOrderIcons.Add(iconGo);
            }
        }

        public void PlayReaction(bool positive)
        {
            if (positive && happyReactionIcon != null)
            {
                happyReactionIcon.SetActive(true);
            }
            else if (!positive && angryReactionIcon != null)
            {
                angryReactionIcon.SetActive(true);
            }
        }
    }
}
