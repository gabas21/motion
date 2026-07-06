package services

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/pkg/logger"
)

type TripayService struct{}

var InstanceTripayService = &TripayService{}

// TripayResponse wrapper
type TripayResponse struct {
	Success bool            `json:"success"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type TripayTransactionData struct {
	Reference     string `json:"reference"`
	MerchantRef   string `json:"merchant_ref"`
	PaymentMethod string `json:"payment_method"`
	PaymentName   string `json:"payment_name"`
	Amount        int    `json:"amount"`
	FeeMerchant   int    `json:"fee_merchant"`
	FeeCustomer   int    `json:"fee_customer"`
	TotalFee      int    `json:"total_fee"`
	AmountReceived int   `json:"amount_received"`
	CheckoutURL   string `json:"checkout_url"`
	Status        string `json:"status"` // "UNPAID" | "PAID" | "EXPIRED" | "FAILED"
	QrString      string `json:"qr_string,omitempty"` // For QRIS
	QrURL         string `json:"qr_url,omitempty"`    // For QRIS image URL
}

// GenerateSignature generates the HMAC-SHA256 signature for transaction creation
func (t *TripayService) GenerateSignature(merchantRef string, amount int) string {
	payload := fmt.Sprintf("%s%s%d", config.AppConfig.TripayMerchantCode, merchantRef, amount)
	h := hmac.New(sha256.New, []byte(config.AppConfig.TripayPrivateKey))
	h.Write([]byte(payload))
	return hex.EncodeToString(h.Sum(nil))
}

// VerifyWebhookSignature verifies signature sent from Tripay webhook
func (t *TripayService) VerifyWebhookSignature(rawBody []byte, callbackSignature string) bool {
	h := hmac.New(sha256.New, []byte(config.AppConfig.TripayPrivateKey))
	h.Write(rawBody)
	expectedSignature := hex.EncodeToString(h.Sum(nil))
	return hmac.Equal([]byte(expectedSignature), []byte(callbackSignature))
}

// CreateQRISTransaction sends transaction request to Tripay using QRIS channel
func (t *TripayService) CreateQRISTransaction(orderID string, amount int, name, email string) (*TripayTransactionData, error) {
	apiURL := fmt.Sprintf("%s/transaction/create", config.AppConfig.TripayApiURL)

	signature := t.GenerateSignature(orderID, amount)

	// Format payload sesuai spec Tripay
	form := url.Values{}
	form.Set("method", "QRIS") // QRIS atau QRIS2
	form.Set("merchant_ref", orderID)
	form.Set("amount", fmt.Sprintf("%d", amount))
	form.Set("customer_name", name)
	form.Set("customer_email", email)
	form.Set("signature", signature)
	
	// Items list
	item := map[string]interface{}{
		"name":     "Motion Premium Pro (1 Bulan)",
		"price":    amount,
		"quantity": 1,
	}
	itemsJSON, _ := json.Marshal([]interface{}{item})
	form.Set("order_items", string(itemsJSON))

	req, err := http.NewRequest("POST", apiURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Bearer "+config.AppConfig.TripayApiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logger.Error("Tripay API Request Failed", err)
		return nil, err
	}
	defer resp.Body.Close()

	var tripayResp TripayResponse
	if err := json.NewDecoder(resp.Body).Decode(&tripayResp); err != nil {
		return nil, err
	}

	if !tripayResp.Success {
		return nil, errors.New("Tripay error: " + tripayResp.Message)
	}

	var data TripayTransactionData
	if err := json.Unmarshal(tripayResp.Data, &data); err != nil {
		return nil, err
	}

	return &data, nil
}
