package services

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type CacheItem struct {
	Data      interface{}
	ExpiresAt time.Time
}

type AnalyticsCache struct {
	data map[string]CacheItem
	mu   sync.RWMutex
}

var analyticsGlobalCache = &AnalyticsCache{
	data: make(map[string]CacheItem),
}

// GetAnalyticsCache retrieves an item from the cache if not expired
func GetAnalyticsCache(key string) (interface{}, bool) {
	analyticsGlobalCache.mu.RLock()
	defer analyticsGlobalCache.mu.RUnlock()

	item, exists := analyticsGlobalCache.data[key]
	if !exists {
		return nil, false
	}

	if time.Now().After(item.ExpiresAt) {
		// Asynchronously delete expired item
		go deleteAnalyticsCache(key)
		return nil, false
	}

	return item.Data, true
}

// SetAnalyticsCache sets an item in the cache with a TTL
func SetAnalyticsCache(key string, value interface{}, ttl time.Duration) {
	analyticsGlobalCache.mu.Lock()
	defer analyticsGlobalCache.mu.Unlock()

	analyticsGlobalCache.data[key] = CacheItem{
		Data:      value,
		ExpiresAt: time.Now().Add(ttl),
	}
}

// deleteAnalyticsCache deletes a cache key internally
func deleteAnalyticsCache(key string) {
	analyticsGlobalCache.mu.Lock()
	defer analyticsGlobalCache.mu.Unlock()
	delete(analyticsGlobalCache.data, key)
}

// InvalidateUserCache invalidates all cached items for a given user ID
func InvalidateUserCache(userID uuid.UUID) {
	analyticsGlobalCache.mu.Lock()
	defer analyticsGlobalCache.mu.Unlock()

	userStr := userID.String()
	// Loop over all keys and delete the ones starting with this user ID
	for k := range analyticsGlobalCache.data {
		// Key format is "dashboard:{userID}:{range}" or "insights:{userID}:{range}"
		// Checking if key contains the user's UUID string
		if len(k) >= 36 {
			// Find matches
			// A simple check is sufficient since UUID string is unique
			if containsUserUUID(k, userStr) {
				delete(analyticsGlobalCache.data, k)
			}
		}
	}
}

func containsUserUUID(s, uuidStr string) bool {
	// Simple lookup
	// Since keys are formatted with colons: e.g. "dashboard:uuid-here:7"
	// We can check if uuidStr is a substring
	for i := 0; i <= len(s)-len(uuidStr); i++ {
		if s[i:i+len(uuidStr)] == uuidStr {
			return true
		}
	}
	return false
}
