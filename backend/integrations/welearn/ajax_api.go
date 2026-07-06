package welearn

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"gorm.io/gorm"
)

// fetchCoursesViaAJAX retrieves courses using the numeric Moodle User ID via AJAX.
func fetchCoursesViaAJAX(session *WeLearnSession, sesskey string, moodleUserID int64) ([]moodleCourseItem, error) {
	reqs := []ajaxRequest{
		{
			Index:      0,
			MethodName: "core_enrol_get_users_courses",
			Args: map[string]any{
				"userid":          moodleUserID,
				"returnusercount": false,
			},
		},
	}

	envelope, err := session.callAJAX(sesskey, reqs)
	if err != nil {
		return nil, err
	}
	if len(envelope) == 0 || envelope[0].Error {
		errMsg := "AJAX courses error"
		if len(envelope) > 0 {
			if envelope[0].Exception != nil {
				fmt.Printf("[welearn-ajax-debug] Moodle AJAX Exception: Code=%s, Message=%s\n", envelope[0].Exception.ErrorCode, envelope[0].Exception.Message)
				errMsg = "Moodle: " + envelope[0].Exception.Message
			} else {
				fmt.Printf("[welearn-ajax-debug] Envelope item error: %v, raw data: %s\n", envelope[0].Error, string(envelope[0].Data))
			}
			if len(envelope[0].Data) > 0 {
				var detail map[string]any
				if json.Unmarshal(envelope[0].Data, &detail) == nil {
					if msg, ok := detail["message"].(string); ok {
						errMsg = "Moodle: " + msg
					}
				}
			}
		}
		return nil, fmt.Errorf("%s", errMsg)
	}

	var courses []moodleCourseItem
	if err := json.Unmarshal(envelope[0].Data, &courses); err != nil {
		return nil, fmt.Errorf("gagal parse daftar courses: %w", err)
	}
	return courses, nil
}

// fetchCourseContentsViaAJAX retrieves sections and modules of a specific course using AJAX.
func fetchCourseContentsViaAJAX(session *WeLearnSession, sesskey, courseID string) ([]moodleSectionItem, error) {
	reqs := []ajaxRequest{
		{
			Index:      0,
			MethodName: "core_course_get_contents",
			Args: map[string]any{
				"courseid": courseID,
				"options":  []map[string]any{{"name": "includestealthmodules", "value": 1}},
			},
		},
	}

	envelope, err := session.callAJAX(sesskey, reqs)
	if err != nil {
		return nil, err
	}
	if len(envelope) == 0 || envelope[0].Error {
		return nil, fmt.Errorf("AJAX course_contents error courseID=%s", courseID)
	}

	var sections []moodleSectionItem
	if err := json.Unmarshal(envelope[0].Data, &sections); err != nil {
		return nil, fmt.Errorf("gagal parse sections courseID=%s: %w", courseID, err)
	}
	return sections, nil
}

// DebugScrapeAJAX executes a sync simulation via AJAX and returns diagnostic results (does not save to DB).
func DebugScrapeAJAX(db *gorm.DB, conn *models.MoodleConnection) DebugScrapeResult {
	result := DebugScrapeResult{}

	password, err := utils.DecryptWithSalt(conn.EncryptedPassword, conn.UserID.String())
	if err != nil {
		passwordOld, errOld := utils.DecryptPassword(conn.EncryptedPassword)
		if errOld != nil {
			result.LoginError = fmt.Sprintf("gagal dekripsi password (salted: %v, old: %v)", err, errOld)
			return result
		}
		password = passwordOld
	}

	session := NewWeLearnSession(conn.MoodleUsername, password, conn.MoodleBaseURL)

	if err := session.Login(); err != nil {
		result.LoginSuccess = false
		result.LoginError = err.Error()
		return result
	}
	result.LoginSuccess = true

	info, err := session.extractSessionInfo()
	if err != nil {
		result.SyncError = "Gagal ekstrak session info: " + err.Error()
		return result
	}
	result.MoodleUserID = info.UserID
	if len(info.Sesskey) >= 6 {
		result.Sesskey = info.Sesskey[:6] + "…"
	}

	courses, err := fetchCoursesViaAJAX(session, info.Sesskey, info.UserID)
	if err != nil {
		result.SyncError = "Gagal fetch courses: " + err.Error()
		return result
	}
	result.CoursesFound = len(courses)

	activePrefix := config.AppConfig.ActiveSemesterPrefix
	for _, c := range courses {
		if activePrefix != "" && !strings.Contains(c.FullName, activePrefix) {
			continue
		}
		cID := fmt.Sprintf("%d", c.ID)
		sections, err := fetchCourseContentsViaAJAX(session, info.Sesskey, cID)
		if err != nil {
			continue
		}
		for _, sec := range sections {
			for _, mod := range sec.Modules {
				if mod.UserVisible && (mod.ModName == "assign" || mod.ModName == "quiz" || mod.ModName == "forum") {
					result.ActivitiesFound++
				}
			}
		}
	}

	return result
}
