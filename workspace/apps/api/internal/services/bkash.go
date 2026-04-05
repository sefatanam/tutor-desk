// Package services contains external service integrations.
package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/tutor-desk/api/internal/config"
)

// BkashClient handles all communication with the bKash Tokenized Checkout API.
type BkashClient struct {
	baseURL     string
	appKey      string
	appSecret   string
	username    string
	password    string
	callbackURL string
	httpClient  *http.Client
}

// NewBkashClient constructs a BkashClient from config.
func NewBkashClient(cfg *config.Config) *BkashClient {
	return &BkashClient{
		baseURL:     cfg.BkashBaseURL,
		appKey:      cfg.BkashAppKey,
		appSecret:   cfg.BkashAppSecret,
		username:    cfg.BkashUsername,
		password:    cfg.BkashPassword,
		callbackURL: cfg.BkashCallbackURL,
		httpClient:  &http.Client{Timeout: time.Duration(cfg.BkashHTTPTimeoutS) * time.Second},
	}
}

// ─── Response types ───────────────────────────────────────────────────────────

type grantTokenResponse struct {
	StatusCode    string `json:"statusCode"`
	StatusMessage string `json:"statusMessage"`
	IDToken       string `json:"id_token"`
	TokenType     string `json:"token_type"`
	ExpiresIn     int    `json:"expires_in"`
	RefreshToken  string `json:"refresh_token"`
}

// CreatePaymentResult holds the bKash-hosted payment URL and opaque paymentID.
type CreatePaymentResult struct {
	PaymentID string `json:"paymentID"`
	BkashURL  string `json:"bkashURL"`
}

type createPaymentResponse struct {
	StatusCode    string `json:"statusCode"`
	StatusMessage string `json:"statusMessage"`
	PaymentID     string `json:"paymentID"`
	BkashURL      string `json:"bkashURL"`
}

// ExecutePaymentResult holds the confirmed transaction details.
type ExecutePaymentResult struct {
	PaymentID     string `json:"paymentID"`
	TrxID         string `json:"trxID"`
	TransactionStatus string `json:"transactionStatus"`
	Amount        string `json:"amount"`
	Currency      string `json:"currency"`
}

type executePaymentResponse struct {
	StatusCode        string `json:"statusCode"`
	StatusMessage     string `json:"statusMessage"`
	PaymentID         string `json:"paymentID"`
	TrxID             string `json:"trxID"`
	TransactionStatus string `json:"transactionStatus"`
	Amount            string `json:"amount"`
	Currency          string `json:"currency"`
}

// ─── API methods ──────────────────────────────────────────────────────────────

// GrantToken fetches a short-lived bKash access token.
func (c *BkashClient) GrantToken() (string, error) {
	body, _ := json.Marshal(map[string]string{
		"app_key":    c.appKey,
		"app_secret": c.appSecret,
	})

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/tokenized/checkout/token/grant", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("username", c.username)
	req.Header.Set("password", c.password)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("bkash grant token request: %w", err)
	}
	defer resp.Body.Close()

	var result grantTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("bkash grant token decode: %w", err)
	}
	if result.StatusCode != "0000" {
		return "", fmt.Errorf("bkash grant token failed: %s", result.StatusMessage)
	}
	return result.IDToken, nil
}

// CreatePayment initiates a payment session and returns the hosted checkout URL.
func (c *BkashClient) CreatePayment(token string, amountBDT int, merchantInvoiceNumber string) (*CreatePaymentResult, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"mode":                  "0011",
		"payerReference":        merchantInvoiceNumber,
		"callbackURL":           c.callbackURL,
		"amount":                fmt.Sprintf("%d", amountBDT),
		"currency":              "BDT",
		"intent":                "sale",
		"merchantInvoiceNumber": merchantInvoiceNumber,
	})

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/tokenized/checkout/create", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", token)
	req.Header.Set("X-APP-Key", c.appKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bkash create payment request: %w", err)
	}
	defer resp.Body.Close()

	var result createPaymentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("bkash create payment decode: %w", err)
	}
	if result.StatusCode != "0000" {
		return nil, fmt.Errorf("bkash create payment failed: %s", result.StatusMessage)
	}
	return &CreatePaymentResult{
		PaymentID: result.PaymentID,
		BkashURL:  result.BkashURL,
	}, nil
}

// ExecutePayment confirms a completed payment and retrieves the transaction ID.
func (c *BkashClient) ExecutePayment(token, paymentID string) (*ExecutePaymentResult, error) {
	body, _ := json.Marshal(map[string]string{
		"paymentID": paymentID,
	})

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/tokenized/checkout/execute", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", token)
	req.Header.Set("X-APP-Key", c.appKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bkash execute payment request: %w", err)
	}
	defer resp.Body.Close()

	var result executePaymentResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("bkash execute payment decode: %w", err)
	}
	if result.StatusCode != "0000" {
		return nil, fmt.Errorf("bkash execute payment failed: %s", result.StatusMessage)
	}
	return &ExecutePaymentResult{
		PaymentID:         result.PaymentID,
		TrxID:             result.TrxID,
		TransactionStatus: result.TransactionStatus,
		Amount:            result.Amount,
		Currency:          result.Currency,
	}, nil
}
