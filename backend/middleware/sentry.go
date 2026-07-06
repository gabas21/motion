package middleware

import (
	"github.com/getsentry/sentry-go"
	"github.com/labstack/echo/v4"
)

// SentryMiddleware returns a middleware that captures panics and sends them to Sentry for Echo v4.
func SentryMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			hub := sentry.CurrentHub().Clone()
			hub.Scope().SetRequest(c.Request())
			c.Set("sentry", hub)

			defer func() {
				if err := recover(); err != nil {
					hub.Recover(err)
					panic(err) // Re-panic agar Recover middleware standard Echo bisa menangkapnya
				}
			}()
			return next(c)
		}
	}
}
