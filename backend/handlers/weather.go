package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/labstack/echo/v4"
	"github.com/motion/backend/config"
	"github.com/motion/backend/pkg/utils"
)

// GetWeatherProxy proxies requests to WeatherAPI.com, hiding the API key from clients
func GetWeatherProxy(c echo.Context) error {
	city := c.QueryParam("city")
	if city == "" {
		return utils.JSONError(c, http.StatusBadRequest, "city parameter required")
	}

	apiKey := config.AppConfig.WeatherAPIKey
	if apiKey == "" {
		return utils.JSONError(c, http.StatusInternalServerError, "weather service not configured")
	}

	// Call weather API from backend (secure)
	resp, err := http.Get(fmt.Sprintf(
		"https://api.weatherapi.com/v1/current.json?key=%s&q=%s&aqi=no",
		apiKey, city,
	))
	if err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "failed to contact weather service")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errData map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errData)
		return c.JSON(resp.StatusCode, errData)
	}

	var weatherData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&weatherData); err != nil {
		return utils.JSONError(c, http.StatusInternalServerError, "failed to parse weather data")
	}

	return c.JSON(http.StatusOK, weatherData)
}
