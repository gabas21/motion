package services

import (
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/motion/backend/config"
	"github.com/motion/backend/integrations/welearn"
	"github.com/motion/backend/models"
)

// StartWeLearnCronSync memulai scheduler sinkronisasi WeLearn berkala dengan concurrency limiter
func StartWeLearnCronSync() {
	// Jalankan berkala setiap 2 jam
	ticker := time.NewTicker(2 * time.Hour)
	go func() {
		// Tunggu 30 detik saat startup agar DB siap
		time.Sleep(30 * time.Second)
		runWeLearnCronSyncAll()

		for range ticker.C {
			log.Println("[welearn-cron] Memulai sinkronisasi otomatis berkala...")
			runWeLearnCronSyncAll()
		}
	}()
	log.Println("[welearn-cron] ✓ Scheduler terdaftar (sinkronisasi setiap 2 jam).")
}

func runWeLearnCronSyncAll() {
	if config.DB == nil {
		log.Println("[welearn-cron] Database tidak terhubung. Batalkan sync.")
		return
	}

	var connections []models.MoodleConnection
	if err := config.DB.Where("is_connected = true").Find(&connections).Error; err != nil {
		log.Printf("[welearn-cron] Gagal memuat daftar koneksi aktif: %v", err)
		return
	}

	total := len(connections)
	if total == 0 {
		return
	}

	log.Printf("[welearn-cron] Memproses sinkronisasi untuk %d user...", total)

	// Concurrency limiter: Batasi maksimal 5 user sync bersamaan menggunakan semaphore + WaitGroup
	sem := make(chan struct{}, 5)
	var wg sync.WaitGroup

	for i := range connections {
		conn := &connections[i]

		sem <- struct{}{} // Ambil slot semaphore
		wg.Add(1)
		go func(c *models.MoodleConnection) {
			defer wg.Done()
			defer func() { <-sem }() // Lepas slot semaphore setelah selesai

			// Jitter acak 0–3 menit agar login ke WeLearn tidak serentak semua user
			jitter := time.Duration(rand.Intn(180)) * time.Second
			time.Sleep(jitter)

			log.Printf("[welearn-cron] Memulai sync untuk user %s...", c.UserID)
			// Panggil SyncViaREST (yang akan fallback ke AJAX jika REST gagal)
			if err := welearn.SyncViaREST(config.DB, c, nil); err != nil {
				log.Printf("[welearn-cron] ⚠ Sync gagal untuk user %s: %v", c.UserID, err)
			} else {
				log.Printf("[welearn-cron] ✓ Sync berhasil untuk user %s", c.UserID)
			}
		}(conn)
	}

	// Tunggu semua goroutine selesai dengan benar menggunakan WaitGroup
	wg.Wait()
	log.Printf("[welearn-cron] ✓ Batch sinkronisasi selesai (%d user diproses).", total)
}
