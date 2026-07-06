package logger

import (
	"log/slog"
	"os"

	"github.com/getsentry/sentry-go"
)

var L *slog.Logger

func init() {
	level := slog.LevelInfo

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level:     level,
		AddSource: true,
	})
	L = slog.New(handler)
	slog.SetDefault(L)
}

func Error(msg string, err error, args ...any) {
	L.Error(msg, append(args, "error", err)...)
	sentry.CaptureException(err)
}

func Info(msg string, args ...any) {
	L.Info(msg, args...)
}

func Warn(msg string, args ...any) {
	L.Warn(msg, args...)
}
