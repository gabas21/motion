package config

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient adalah singleton instance untuk koneksi Redis
var RedisClient *redis.Client

// ConnectRedis melakukan inisialisasi koneksi ke server Redis
func ConnectRedis() {
	var opts *redis.Options

	// 1. Coba hubungkan menggunakan full URL jika tersedia (biasanya di Railway)
	if rawURL := resolveRedisURL(); rawURL != "" {
		parsed, err := redis.ParseURL(rawURL)
		if err == nil {
			opts = parsed
			log.Println("[Redis] Menggunakan konfigurasi koneksi dari REDIS_URL/REDIS_PRIVATE_URL")
		} else {
			log.Printf("[Redis] Gagal mem-parsing REDIS_URL: %v. Fallback ke Host/Port config.", err)
		}
	}

	// 2. Jika URL tidak diset atau gagal diparsing, gunakan host, port, dan password manual
	if opts == nil {
		addr := AppConfig.RedisHost + ":" + AppConfig.RedisPort
		log.Printf("[Redis] Menghubungkan ke %s...", addr)
		opts = &redis.Options{
			Addr:     addr,
			Password: AppConfig.RedisPassword,
			DB:       0,
		}
	}

	// 3. Konfigurasi pooling & timeout parameter secara aman
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second
	opts.PoolSize = 10
	opts.MinIdleConns = 2

	client := redis.NewClient(opts)

	// Test PING koneksi ke Redis
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[Redis] WARN: Gagal menghubungi server Redis: %v. Aplikasi akan tetap berjalan dengan fallback in-memory.", err)
		return
	}

	RedisClient = client
	log.Println("[Redis] ✓ Koneksi Redis berhasil diinisialisasi.")
}

// IsRedisAvailable mengecek apakah koneksi Redis siap digunakan
func IsRedisAvailable() bool {
	return RedisClient != nil
}
