// TurnFlowController.cs — Master orchestrator for gameplay turns in Unity.
// Stepping simulation with Time.deltaTime, updating HUD, spawning customers, audio triggers, and score screens.
#nullable enable
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Churrasco.Core;

namespace Churrasco.Runtime
{
    public sealed class TurnFlowController : MonoBehaviour
    {
        [Header("Views")]
        [SerializeField] private GrillView? grillView;
        [SerializeField] private RectTransform? customerQueueContainer;
        [SerializeField] private GameObject? customerCardPrefab;

        [Header("HUD")]
        [SerializeField] private TMP_Text? timerText;
        [SerializeField] private TMP_Text? scoreText;
        [SerializeField] private TMP_Text? coinsText;
        [SerializeField] private TMP_Text? comboText;

        [Header("Result Modal")]
        [SerializeField] private GameObject? resultModalPanel;
        [SerializeField] private TMP_Text? resultCoinsEarnedText;
        [SerializeField] private TMP_Text? resultXpEarnedText;
        [SerializeField] private TMP_Text? resultPerfectCountText;
        [SerializeField] private TMP_Text? resultRatingStarsText;
        [SerializeField] private Button? returnHomeButton;

        [Header("Controllers")]
        [SerializeField] private AudioController? audioController;
        [SerializeField] private SaveManager? saveManager;

        private TurnSimulation? simulation;
        private readonly Dictionary<string, CustomerCardView> activeCustomerViews = new();
        private bool isTurnActive = false;

        public TurnSimulation? CurrentSimulation => simulation;
        public bool IsActive => isTurnActive;

        public event Action<TurnResult>? OnTurnFinished;

        private void Awake()
        {
            if (returnHomeButton != null)
            {
                returnHomeButton.onClick.AddListener(OnReturnHomeClicked);
            }
        }

        public void StartTurn(TurnConfig config, ChurrasqueiraDef churrasqueira, bool hasFourthZone, StaffState? staff = null)
        {
            simulation = new TurnSimulation(config, churrasqueira, staff);
            isTurnActive = true;

            if (grillView != null)
            {
                grillView.BindSimulation(simulation, hasFourthZone);
                grillView.OnRefillRequested += HandleRefillRequested;
            }

            if (resultModalPanel != null)
            {
                resultModalPanel.SetActive(false);
            }

            ClearCustomerViews();
            audioController?.PlayMusic(AudioTrack.Gameplay);
        }

        private void Update()
        {
            if (!isTurnActive || simulation == null) return;

            float dt = Mathf.Min(Time.deltaTime, 0.1f);
            simulation.Tick(dt);

            var state = simulation.State;
            UpdateHUD(state);

            if (grillView != null)
            {
                grillView.UpdateGrillDisplay(state);
            }

            SyncCustomers(state);

            if (state.IsComplete)
            {
                FinishTurn();
            }
        }

        private void UpdateHUD(TurnState state)
        {
            if (timerText != null)
            {
                int remaining = Mathf.Max(0, Mathf.CeilToInt((float)(state.DurationSec - state.ElapsedSec)));
                timerText.text = $"{remaining / 60:D2}:{remaining % 60:D2}";
            }

            if (scoreText != null)
                scoreText.text = state.Score.ToString("N0");

            if (coinsText != null)
                coinsText.text = state.CoinsEarned.ToString("N0");

            if (comboText != null)
            {
                comboText.gameObject.SetActive(state.CurrentCombo > 1);
                comboText.text = $"x{state.CurrentCombo} COMBO!";
            }
        }

        private void SyncCustomers(TurnState state)
        {
            var activeIds = new HashSet<string>();

            foreach (var customer in state.Customers)
            {
                activeIds.Add(customer.Id);
                if (!activeCustomerViews.TryGetValue(customer.Id, out var card))
                {
                    card = SpawnCustomerCard(customer);
                    activeCustomerViews[customer.Id] = card;
                    audioController?.PlaySfx(AudioCue.OrderIn);
                }
                card.UpdateCustomer(customer);
            }

            var toRemove = new List<string>();
            foreach (var kvp in activeCustomerViews)
            {
                if (!activeIds.Contains(kvp.Key))
                {
                    toRemove.Add(kvp.Key);
                }
            }

            foreach (var id in toRemove)
            {
                if (activeCustomerViews.TryGetValue(id, out var card))
                {
                    Destroy(card.gameObject);
                    activeCustomerViews.Remove(id);
                }
            }
        }

        private CustomerCardView SpawnCustomerCard(CustomerState customer)
        {
            Transform parent = customerQueueContainer != null ? customerQueueContainer : transform;
            GameObject go;
            if (customerCardPrefab != null)
            {
                go = Instantiate(customerCardPrefab, parent);
            }
            else
            {
                go = new GameObject($"Customer_{customer.Id}", typeof(RectTransform), typeof(CustomerCardView));
                go.transform.SetParent(parent, false);
            }

            var card = go.GetComponent<CustomerCardView>();
            card.Initialize(customer);
            return card;
        }

        private void HandleRefillRequested()
        {
            if (simulation == null) return;
            simulation.RefillCharcoal();
            audioController?.PlaySfx(AudioCue.CharcoalRefill);
        }

        public void PlaceFood(string foodId, int zoneIndex, int slotIndex)
        {
            if (simulation == null) return;
            simulation.PlaceFood(foodId, zoneIndex, slotIndex);
            audioController?.PlaySfx(AudioCue.PlaceFood);
        }

        public void FlipFood(string instanceId)
        {
            if (simulation == null) return;
            simulation.FlipFood(instanceId);
            audioController?.PlaySfx(AudioCue.FlipFood);
        }

        public void ServeCustomer(string customerId, string foodInstanceId)
        {
            if (simulation == null) return;
            simulation.ServeCustomer(customerId, foodInstanceId);
            audioController?.PlaySfx(AudioCue.Serve);
        }

        private void FinishTurn()
        {
            if (!isTurnActive || simulation == null) return;
            isTurnActive = false;

            var result = simulation.GetResult();
            audioController?.PlayMusic(AudioTrack.Result);

            if (resultModalPanel != null)
            {
                resultModalPanel.SetActive(true);
                if (resultCoinsEarnedText != null) resultCoinsEarnedText.text = $"+{result.CoinsEarned}";
                if (resultXpEarnedText != null) resultXpEarnedText.text = $"+{result.XpEarned} XP";
                if (resultPerfectCountText != null) resultPerfectCountText.text = $"{result.PerfectCount} PERFEITOS";
                if (resultRatingStarsText != null) resultRatingStarsText.text = $"{result.Stars} ESTRELAS";
            }

            OnTurnFinished?.Invoke(result);
        }

        private void OnReturnHomeClicked()
        {
            if (resultModalPanel != null)
                resultModalPanel.SetActive(false);
            audioController?.PlayMusic(AudioTrack.Home);
        }

        private void ClearCustomerViews()
        {
            foreach (var card in activeCustomerViews.Values)
            {
                if (card != null) Destroy(card.gameObject);
            }
            activeCustomerViews.Clear();
        }
    }
}
