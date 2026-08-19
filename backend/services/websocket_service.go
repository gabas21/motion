package services

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/motion/backend/config"
)

// Client mewakili satu koneksi WebSocket aktif dari pengguna
type Client struct {
	Conn   *websocket.Conn
	UserID string
	Send   chan []byte
}

// WebSocketHub mengelola semua koneksi WebSocket klien yang aktif secara thread-safe
type WebSocketHub struct {
	// Memetakan UserID -> Set koneksi Client aktif
	Clients    map[string]map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	Mutex      sync.RWMutex
}

var WSHub *WebSocketHub

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Izinkan CORS, batasi jika di mode produksi
	CheckOrigin: func(r *http.Request) bool {
		if config.AppConfig != nil && config.AppConfig.ServerEnv == "production" {
			origin := r.Header.Get("Origin")
			return origin == config.AppConfig.FrontendURL
		}
		return true
	},
}

// InitWebSocketHub menginisialisasi WebSocket Hub global dan menjalankannya di latar belakang
func InitWebSocketHub() {
	WSHub = &WebSocketHub{
		Clients:    make(map[string]map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
	}
	go WSHub.run()

	// Mulai mendengarkan pesan dari instance lain jika Redis aktif
	if config.IsRedisAvailable() {
		go WSHub.subscribeRedisMessages()
	}
}

// run mengelola pendaftaran dan pencabutan koneksi secara asinkron
func (h *WebSocketHub) run() {
	for {
		select {
		case client := <-h.Register:
			h.Mutex.Lock()
			if _, exists := h.Clients[client.UserID]; !exists {
				h.Clients[client.UserID] = make(map[*Client]bool)
			}
			h.Clients[client.UserID][client] = true
			h.Mutex.Unlock()
			log.Printf("WebSocket: Klien terdaftar untuk UserID: %s", client.UserID)

		case client := <-h.Unregister:
			h.Mutex.Lock()
			if connections, exists := h.Clients[client.UserID]; exists {
				if _, ok := connections[client]; ok {
					delete(connections, client)
					close(client.Send)
					client.Conn.Close()
					log.Printf("WebSocket: Klien terputus untuk UserID: %s", client.UserID)
				}
				if len(connections) == 0 {
					delete(h.Clients, client.UserID)
				}
			}
			h.Mutex.Unlock()
		}
	}
}

type pubSubBroadcastPayload struct {
	UserID  string `json:"userId"`
	Payload []byte `json:"payload"`
}

// Broadcast mengirimkan pesan real-time khusus ke semua koneksi browser milik satu user tertentu.
// Jika Redis aktif, ia akan mem-publish pesan ke semua instance cluster.
func (h *WebSocketHub) Broadcast(userID string, message []byte) {
	if config.IsRedisAvailable() {
		payload := pubSubBroadcastPayload{
			UserID:  userID,
			Payload: message,
		}
		payloadBytes, err := json.Marshal(payload)
		if err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			config.RedisClient.Publish(ctx, "ws:broadcast", payloadBytes)
			cancel()
			return
		}
	}

	// Fallback ke local broadcast jika Redis tidak aktif
	h.localBroadcast(userID, message)
}

// localBroadcast mengirimkan pesan ke koneksi WebSocket yang berada di instance lokal ini saja
func (h *WebSocketHub) localBroadcast(userID string, message []byte) {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	connections, exists := h.Clients[userID]
	if !exists {
		return
	}

	for client := range connections {
		select {
		case client.Send <- message:
		default:
			// Jika buffer send tersendat, hapus koneksi secara aman
			go func(c *Client) {
				h.Unregister <- c
			}(client)
		}
	}
}

// subscribeRedisMessages mendengarkan broadcast pesan dari instance lain via Redis Pub/Sub
func (h *WebSocketHub) subscribeRedisMessages() {
	ctx := context.Background()
	pubsub := config.RedisClient.Subscribe(ctx, "ws:broadcast")
	defer pubsub.Close()

	log.Println("[WebSocket-PubSub] Daemon subscriber Redis diaktifkan.")

	ch := pubsub.Channel()
	for msg := range ch {
		var payload pubSubBroadcastPayload
		err := json.Unmarshal([]byte(msg.Payload), &payload)
		if err != nil {
			log.Printf("[WebSocket-PubSub] Gagal memproses payload broadcast: %v", err)
			continue
		}

		// Pancarkan ke WebSocket yang terkonek lokal pada instance ini
		h.localBroadcast(payload.UserID, payload.Payload)
	}
}

// HandleWebSocketConnection meng-upgrade koneksi HTTP menjadi protokol WebSocket
func HandleWebSocketConnection(w http.ResponseWriter, r *http.Request, userID string) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket: Gagal melakukan upgrade protokol: %v", err)
		return
	}

	client := &Client{
		Conn:   conn,
		UserID: userID,
		Send:   make(chan []byte, 256),
	}

	WSHub.Register <- client

	// Start goroutines untuk menangani baca/tulis koneksi secara simultan
	go client.writePump()
	go client.readPump()
}

// writePump memompa pesan dari channel antrean internal ke koneksi WebSocket browser
func (c *Client) writePump() {
	defer func() {
		WSHub.Unregister <- c
	}()

	for {
		message, ok := <-c.Send
		if !ok {
			// Hub menutup saluran kirim
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		w, err := c.Conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		w.Write(message)

		// Ambil pesan tambahan jika ada di antrean buffer
		n := len(c.Send)
		for i := 0; i < n; i++ {
			w.Write([]byte{'\n'})
			w.Write(<-c.Send)
		}

		if err := w.Close(); err != nil {
			return
		}
	}
}

// readPump membaca pesan masuk dari browser (kita abaikan karena komunikasi satu arah backend->frontend)
func (c *Client) readPump() {
	defer func() {
		WSHub.Unregister <- c
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket: Error pembacaan klien: %v", err)
			}
			break
		}
	}
}
