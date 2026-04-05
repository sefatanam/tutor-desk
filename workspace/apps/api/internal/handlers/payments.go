package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tutor-desk/api/internal/middleware"
	"github.com/tutor-desk/api/internal/models"
	"github.com/tutor-desk/api/internal/services"
)

// PaymentsHandler handles billing plan queries and bKash payment flows.
type PaymentsHandler struct {
	db     *pgxpool.Pool
	bkash  *services.BkashClient
}

func NewPaymentsHandler(db *pgxpool.Pool, bkash *services.BkashClient) *PaymentsHandler {
	return &PaymentsHandler{db: db, bkash: bkash}
}

// ─── Plans ────────────────────────────────────────────────────────────────────

// ListPlans returns all active billing plans.
//
//	@Summary		List billing plans
//	@Tags			Billing
//	@Produce		json
//	@Success		200	{array}		models.BillingPlan
//	@Failure		500	{object}	map[string]string
//	@Router			/billing/plans [get]
func (h *PaymentsHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(r.Context(),
		`SELECT id, name, display_name, price_bdt,
		        max_subjects, max_exams, max_students,
		        can_export, seat_count, active, created_at
		 FROM billing_plans
		 WHERE active = true
		 ORDER BY price_bdt ASC`)
	if err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to fetch plans"})
		return
	}
	defer rows.Close()

	plans := []models.BillingPlan{}
	for rows.Next() {
		var p models.BillingPlan
		if err := rows.Scan(&p.ID, &p.Name, &p.DisplayName, &p.PriceBDT,
			&p.MaxSubjects, &p.MaxExams, &p.MaxStudents,
			&p.CanExport, &p.SeatCount, &p.Active, &p.CreatedAt); err != nil {
			continue
		}
		plans = append(plans, p)
	}
	middleware.WriteJSON(w, http.StatusOK, plans)
}

// ─── Create Payment ───────────────────────────────────────────────────────────

// CreatePayment initiates a bKash payment for the selected plan.
//
//	@Summary		Initiate bKash payment
//	@Tags			Billing
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.CreatePaymentRequest	true	"Plan selection"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/payments/create [post]
func (h *PaymentsHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
	var req models.CreatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PlanID == 0 {
		middleware.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "plan_id is required"})
		return
	}

	teacherID := middleware.GetUserID(r)

	// Fetch plan
	var plan models.BillingPlan
	err := h.db.QueryRow(r.Context(),
		`SELECT id, name, price_bdt FROM billing_plans WHERE id = $1 AND active = true`,
		req.PlanID,
	).Scan(&plan.ID, &plan.Name, &plan.PriceBDT)
	if err != nil {
		middleware.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "plan not found"})
		return
	}

	// Free plan — activate immediately without bKash
	if plan.PriceBDT == 0 {
		if err := h.activateSubscription(r, teacherID, plan.ID, "free"); err != nil {
			middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to activate free plan"})
			return
		}
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": "activated", "plan": plan.Name})
		return
	}

	// Paid plan — call bKash
	token, err := h.bkash.GrantToken()
	if err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "payment gateway unavailable"})
		return
	}

	invoiceRef := fmt.Sprintf("TD-%s-%d-%d", teacherID[:8], plan.ID, time.Now().Unix())
	result, err := h.bkash.CreatePayment(token, plan.PriceBDT, invoiceRef)
	if err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create payment"})
		return
	}

	// Persist pending transaction
	_, err = h.db.Exec(r.Context(),
		`INSERT INTO payment_transactions (teacher_id, plan_id, bkash_payment_id, amount_bdt, status)
		 VALUES ($1, $2, $3, $4, 'pending')`,
		teacherID, plan.ID, result.PaymentID, plan.PriceBDT,
	)
	if err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to record transaction"})
		return
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]string{
		"payment_id": result.PaymentID,
		"bkash_url":  result.BkashURL,
	})
}

// ─── Execute Payment ──────────────────────────────────────────────────────────

// ExecutePayment confirms a bKash payment after the user returns from the hosted page.
//
//	@Summary		Execute bKash payment
//	@Tags			Billing
//	@Accept			json
//	@Produce		json
//	@Security		BearerAuth
//	@Param			body	body		models.ExecutePaymentRequest	true	"Payment confirmation"
//	@Success		200		{object}	map[string]string
//	@Failure		400		{object}	map[string]string
//	@Failure		500		{object}	map[string]string
//	@Router			/payments/execute [post]
func (h *PaymentsHandler) ExecutePayment(w http.ResponseWriter, r *http.Request) {
	var req models.ExecutePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PaymentID == "" {
		middleware.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "payment_id is required"})
		return
	}

	teacherID := middleware.GetUserID(r)

	// Handle user-cancelled payment
	if req.Status == "cancel" || req.Status == "failure" {
		_, _ = h.db.Exec(r.Context(),
			`UPDATE payment_transactions SET status = $1 WHERE bkash_payment_id = $2 AND teacher_id = $3`,
			req.Status, req.PaymentID, teacherID,
		)
		middleware.WriteJSON(w, http.StatusOK, map[string]string{"status": req.Status})
		return
	}

	// Verify transaction belongs to this teacher and is still pending
	var planID int
	var amountBDT int
	err := h.db.QueryRow(r.Context(),
		`SELECT plan_id, amount_bdt FROM payment_transactions
		 WHERE bkash_payment_id = $1 AND teacher_id = $2 AND status = 'pending'`,
		req.PaymentID, teacherID,
	).Scan(&planID, &amountBDT)
	if err != nil {
		middleware.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "transaction not found or already processed"})
		return
	}

	// Execute via bKash
	token, err := h.bkash.GrantToken()
	if err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "payment gateway unavailable"})
		return
	}

	executed, err := h.bkash.ExecutePayment(token, req.PaymentID)
	if err != nil {
		_, _ = h.db.Exec(r.Context(),
			`UPDATE payment_transactions SET status = 'failed' WHERE bkash_payment_id = $1`,
			req.PaymentID,
		)
		middleware.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "payment execution failed"})
		return
	}

	// Mark transaction completed
	_, err = h.db.Exec(r.Context(),
		`UPDATE payment_transactions SET status = 'completed', trx_id = $1 WHERE bkash_payment_id = $2`,
		executed.TrxID, req.PaymentID,
	)
	if err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to update transaction"})
		return
	}

	// Activate subscription
	if err := h.activateSubscription(r, teacherID, planID, executed.TrxID); err != nil {
		middleware.WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "payment confirmed but subscription activation failed"})
		return
	}

	middleware.WriteJSON(w, http.StatusOK, map[string]string{
		"status": "completed",
		"trx_id": executed.TrxID,
	})
}

// ─── My Subscription ─────────────────────────────────────────────────────────

// GetMySubscription returns the authenticated teacher's current subscription.
//
//	@Summary		Get my subscription
//	@Tags			Billing
//	@Produce		json
//	@Security		BearerAuth
//	@Success		200	{object}	models.Subscription
//	@Failure		404	{object}	map[string]string
//	@Router			/subscriptions/me [get]
func (h *PaymentsHandler) GetMySubscription(w http.ResponseWriter, r *http.Request) {
	teacherID := middleware.GetUserID(r)

	var sub models.Subscription
	var plan models.BillingPlan
	err := h.db.QueryRow(r.Context(),
		`SELECT s.id, s.teacher_id, s.plan_id, s.status, s.current_period_start, s.current_period_end, s.created_at,
		        p.id, p.name, p.display_name, p.price_bdt,
		        p.max_subjects, p.max_exams, p.max_students, p.can_export, p.seat_count
		 FROM subscriptions s
		 JOIN billing_plans p ON p.id = s.plan_id
		 WHERE s.teacher_id = $1`,
		teacherID,
	).Scan(
		&sub.ID, &sub.TeacherID, &sub.PlanID, &sub.Status,
		&sub.CurrentPeriodStart, &sub.CurrentPeriodEnd, &sub.CreatedAt,
		&plan.ID, &plan.Name, &plan.DisplayName, &plan.PriceBDT,
		&plan.MaxSubjects, &plan.MaxExams, &plan.MaxStudents, &plan.CanExport, &plan.SeatCount,
	)
	if err != nil {
		// No subscription — return the starter plan details as default
		middleware.WriteJSON(w, http.StatusOK, map[string]interface{}{
			"status": "none",
			"plan":   "starter",
		})
		return
	}
	sub.Plan = &plan
	middleware.WriteJSON(w, http.StatusOK, sub)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// activateSubscription upserts the teacher's subscription to the given plan for one calendar month.
func (h *PaymentsHandler) activateSubscription(r *http.Request, teacherID string, planID int, _ string) error {
	now := time.Now().UTC()
	periodEnd := now.AddDate(0, 1, 0)

	_, err := h.db.Exec(r.Context(),
		`INSERT INTO subscriptions (teacher_id, plan_id, status, current_period_start, current_period_end)
		 VALUES ($1, $2, 'active', $3, $4)
		 ON CONFLICT (teacher_id) DO UPDATE
		   SET plan_id = EXCLUDED.plan_id,
		       status  = 'active',
		       current_period_start = EXCLUDED.current_period_start,
		       current_period_end   = EXCLUDED.current_period_end`,
		teacherID, planID, now, periodEnd,
	)
	return err
}
