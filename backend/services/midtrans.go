package services

import (
	"crypto/sha512"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/midtrans/midtrans-go"
	"github.com/midtrans/midtrans-go/coreapi"
	"github.com/midtrans/midtrans-go/snap"
	"github.com/motion/backend/config"
	"github.com/motion/backend/pkg/logger"
)

type MidtransService struct{}

var InstanceMidtransService = &MidtransService{}

type MidtransSnapResponse struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
}

type MidtransQRISResponse struct {
	OrderID       string `json:"order_id"`
	TransactionID string `json:"transaction_id"`
	StatusCode    string `json:"status_code"`
	QrString      string `json:"qr_string,omitempty"`
	QrURL         string `json:"qr_url,omitempty"`
	CheckoutURL   string `json:"checkout_url,omitempty"`
}

// InitClient initializes Midtrans global configuration
func (m *MidtransService) InitClient() {
	midtrans.ServerKey = config.AppConfig.MidtransServerKey
	midtrans.ClientKey = config.AppConfig.MidtransClientKey
	if config.AppConfig.MidtransIsProduction {
		midtrans.Environment = midtrans.Production
	} else {
		midtrans.Environment = midtrans.Sandbox
	}
}

// CreateSnapTransaction generates a Midtrans Snap transaction token & redirect URL
func (m *MidtransService) CreateSnapTransaction(orderID string, amount int64, name, email string) (*MidtransSnapResponse, error) {
	m.InitClient()

	// Check if running in DEV mock mode without valid server key
	if config.AppConfig.MidtransServerKey == "" || config.AppConfig.MidtransServerKey == "SB-Mid-server-DEV-KEY-CHANGE-ME" {
		logger.Info("[DEV MOCK] Creating Mock Midtrans Snap Transaction", "orderID", orderID, "amount", amount)
		return &MidtransSnapResponse{
			Token:       fmt.Sprintf("DEV-SNAP-TOKEN-%s", orderID),
			RedirectURL: fmt.Sprintf("%s/subscription/checkout?order_id=%s", config.AppConfig.FrontendURL, orderID),
		}, nil
	}

	snapReq := &snap.Request{
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  orderID,
			GrossAmt: amount,
		},
		CustomerDetail: &midtrans.CustomerDetails{
			FName: name,
			Email: email,
		},
		Items: &[]midtrans.ItemDetails{
			{
				ID:    "pro-1m",
				Name:  "Motion Premium Pro (1 Bulan)",
				Price: amount,
				Qty:   1,
			},
		},
	}

	snapResp, err := snap.CreateTransaction(snapReq)
	if err != nil {
		logger.Error("Midtrans Snap Transaction Creation Failed", err, "orderID", orderID)
		return nil, errors.New("Midtrans error: " + err.Message)
	}

	return &MidtransSnapResponse{
		Token:       snapResp.Token,
		RedirectURL: snapResp.RedirectURL,
	}, nil
}

// CreateQRISCoreTransaction generates a direct QRIS payment via Midtrans Core API
func (m *MidtransService) CreateQRISCoreTransaction(orderID string, amount int64, name, email string) (*MidtransQRISResponse, error) {
	m.InitClient()

	// Dev Mock mode fallback
	if config.AppConfig.MidtransServerKey == "" || config.AppConfig.MidtransServerKey == "SB-Mid-server-DEV-KEY-CHANGE-ME" {
		logger.Info("[DEV MOCK] Creating Mock Midtrans QRIS Transaction", "orderID", orderID)
		mockQrString := fmt.Sprintf("00020101021226670016ID.CO.MOTION.WWW011893600911002200780215INV-%s5204581253033605405300005802ID5906MOTION6007JAKARTA63040000", orderID)
		return &MidtransQRISResponse{
			OrderID:       orderID,
			TransactionID: fmt.Sprintf("TRX-%s", orderID),
			StatusCode:    "201",
			QrString:      mockQrString,
			QrURL:          fmt.Sprintf("https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=%s", mockQrString),
			CheckoutURL:   fmt.Sprintf("%s/subscription/checkout?order_id=%s", config.AppConfig.FrontendURL, orderID),
		}, nil
	}

	coreReq := &coreapi.ChargeReq{
		PaymentType: coreapi.PaymentTypeQris,
		TransactionDetails: midtrans.TransactionDetails{
			OrderID:  orderID,
			GrossAmt: amount,
		},
		CustomerDetails: &midtrans.CustomerDetails{
			FName: name,
			Email: email,
		},
		Qris: &coreapi.QrisDetails{
			Acquirer: "gopay",
		},
		Items: &[]midtrans.ItemDetails{
			{
				ID:    "pro-1m",
				Name:  "Motion Premium Pro (1 Bulan)",
				Price: amount,
				Qty:   1,
			},
		},
	}

	resp, err := coreapi.ChargeTransaction(coreReq)
	if err != nil {
		logger.Error("Midtrans Core QRIS Charge Failed", err, "orderID", orderID)
		return nil, errors.New("Midtrans QRIS error: " + err.Message)
	}

	var qrString, qrURL string
	for _, action := range resp.Actions {
		if action.Name == "generate-qr-code" {
			qrURL = action.URL
		}
	}
	qrString = resp.QRString

	return &MidtransQRISResponse{
		OrderID:       resp.OrderID,
		TransactionID: resp.TransactionID,
		StatusCode:    resp.StatusCode,
		QrString:      qrString,
		QrURL:          qrURL,
		CheckoutURL:   fmt.Sprintf("%s/subscription/checkout?order_id=%s", config.AppConfig.FrontendURL, orderID),
	}, nil
}

// VerifyWebhookSignature verifies Midtrans SHA-512 signature: SHA512(order_id + status_code + gross_amount + ServerKey)
func (m *MidtransService) VerifyWebhookSignature(orderID, statusCode, grossAmount, signatureKey string) bool {
	isDevKey := config.AppConfig.MidtransServerKey == "" || config.AppConfig.MidtransServerKey == "SB-Mid-server-DEV-KEY-CHANGE-ME"
	isDevEnv := config.AppConfig.ServerEnv != "production"

	if isDevKey && isDevEnv {
		return true // Allow mock signature only in development mode
	}
	payload := orderID + statusCode + grossAmount + config.AppConfig.MidtransServerKey
	hash := sha512.Sum512([]byte(payload))
	expectedSignature := hex.EncodeToString(hash[:])
	return expectedSignature == signatureKey
}
