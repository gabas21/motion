package welearn

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

// WeLearnCircuitBreaker monitors the health of the connection to the WeLearn server.
type WeLearnCircuitBreaker struct {
	failureCount  int
	lastFailureAt time.Time
	state         string // "closed", "open", "half-open"
	mu            sync.Mutex
}

const (
	maxFailures     = 10
	recoveryTimeout = 2 * time.Minute
)

// GlobalCircuitBreaker is the package-wide circuit breaker.
var GlobalCircuitBreaker = &WeLearnCircuitBreaker{
	state: "closed",
}

// CanRequest checks if a request is allowed to proceed under the current breaker state.
func (cb *WeLearnCircuitBreaker) CanRequest() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	if cb.state == "open" {
		if now.Sub(cb.lastFailureAt) > recoveryTimeout {
			cb.state = "half-open"
			return true
		}
		return false
	}
	return true
}

// RecordSuccess records a successful request and resets/closes the breaker.
func (cb *WeLearnCircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount = 0
	cb.state = "closed"
}

// RecordFailure records a failure, opening the breaker if failure count exceeds limits.
func (cb *WeLearnCircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failureCount++
	cb.lastFailureAt = time.Now()

	if cb.state == "half-open" || cb.failureCount >= maxFailures {
		cb.state = "open"
	}
}

// State returns the current state of the breaker.
func (cb *WeLearnCircuitBreaker) State() string {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

// isTransientError returns true if the error is a transient network timeout, DNS issue, or server error.
func isTransientError(err error) bool {
	if err == nil {
		return false
	}

	// Check if it is a net.Error timeout or temporary network issue
	if netErr, ok := err.(net.Error); ok {
		if netErr.Timeout() {
			return true
		}
	}

	// Check context deadlines
	if err == context.DeadlineExceeded {
		return true
	}

	errStr := strings.ToLower(err.Error())

	// Check common network/timeout strings
	if strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "deadline exceeded") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "no such host") ||
		strings.Contains(errStr, "unexpected eof") ||
		(strings.Contains(errStr, "http status") && (strings.Contains(errStr, "500") || strings.Contains(errStr, "502") || strings.Contains(errStr, "503") || strings.Contains(errStr, "504"))) {
		return true
	}

	return false
}

// Execute runs a function wrapped with circuit breaker protection.
func (cb *WeLearnCircuitBreaker) Execute(fn func() error) error {
	if !cb.CanRequest() {
		return fmt.Errorf("CIRCUIT_BREAKER_OPEN: WeLearn server appears to be offline or slow. Please try again later.")
	}

	err := fn()
	if err != nil {
		if isTransientError(err) {
			cb.RecordFailure()
		}
		return err
	}

	cb.RecordSuccess()
	return nil
}
