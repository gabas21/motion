package welearn

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"gorm.io/gorm"
)

// loginViaToken calls Moodle's token.php to get a Web Service token.
func loginViaToken(baseURL, username, password string) (string, error) {
	var token string
	err := GlobalCircuitBreaker.Execute(func() error {
		tokenURL := fmt.Sprintf("%s/login/token.php", baseURL)
		formData := url.Values{
			"username": {username},
			"password": {password},
			"service":  {"moodle_mobile_app"},
		}

		resp, err := restPostForm(tokenURL, formData)
		if err != nil {
			return fmt.Errorf("network error contacting token.php: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("unexpected HTTP status from token.php: %d", resp.StatusCode)
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read token response: %w", err)
		}

		var tr moodleTokenResponse
		if err := json.Unmarshal(bodyBytes, &tr); err != nil {
			return fmt.Errorf("failed to parse token JSON: %w", err)
		}

		if tr.Error != "" {
			return fmt.Errorf("token error (%s): %s", tr.ErrorCode, tr.Error)
		}
		if tr.Token == "" {
			return fmt.Errorf("no token returned by Moodle")
		}

		token = tr.Token
		return nil
	})

	return token, err
}

// fetchUserIDViaREST calls core_webservice_get_site_info to fetch the numeric Moodle user ID.
func fetchUserIDViaREST(baseURL, wstoken string) (int64, error) {
	var userID int64
	err := GlobalCircuitBreaker.Execute(func() error {
		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&wstoken=%s&moodlewsrestformat=json", baseURL, wstoken)
		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("site info network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)
		var sir moodleSiteInfoResponse
		if err := json.Unmarshal(bodyBytes, &sir); err != nil {
			return fmt.Errorf("failed to parse site info JSON: %w", err)
		}

		if sir.Exception != "" {
			return fmt.Errorf("site info exception: %s", sir.Message)
		}
		if sir.UserID == 0 {
			return fmt.Errorf("invalid userid returned in site info")
		}

		userID = sir.UserID
		return nil
	})

	return userID, err
}

// fetchCoursesViaREST retrieves the enrolled courses for the student using REST.
func fetchCoursesViaREST(baseURL, wstoken string, uID int64) ([]moodleCourseItem, error) {
	var courses []moodleCourseItem
	err := GlobalCircuitBreaker.Execute(func() error {
		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=core_enrol_get_users_courses&wstoken=%s&userid=%d&moodlewsrestformat=json", baseURL, wstoken, uID)
		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("REST courses network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)

		var exception struct {
			Exception string `json:"exception"`
			Message   string `json:"message"`
		}
		if json.Unmarshal(bodyBytes, &exception) == nil && exception.Exception != "" {
			return fmt.Errorf("Moodle courses exception: %s", exception.Message)
		}

		var items []moodleCourseItem
		if err := json.Unmarshal(bodyBytes, &items); err != nil {
			return fmt.Errorf("failed to decode courses list: %w", err)
		}

		courses = items
		return nil
	})

	return courses, err
}

// fetchCourseContentsViaREST fetches the sections and activities of a specific course using REST.
func fetchCourseContentsViaREST(baseURL, wstoken, courseID string) ([]moodleSectionItem, error) {
	var sections []moodleSectionItem
	err := GlobalCircuitBreaker.Execute(func() error {
		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=core_course_get_contents&wstoken=%s&courseid=%s&moodlewsrestformat=json", baseURL, wstoken, courseID)
		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("REST contents network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)

		var exception struct {
			Exception string `json:"exception"`
			Message   string `json:"message"`
		}
		if json.Unmarshal(bodyBytes, &exception) == nil && exception.Exception != "" {
			return fmt.Errorf("Moodle contents exception course=%s: %s", courseID, exception.Message)
		}

		var items []moodleSectionItem
		if err := json.Unmarshal(bodyBytes, &items); err != nil {
			return fmt.Errorf("failed to decode contents course=%s: %w", courseID, err)
		}

		sections = items
		return nil
	})

	return sections, err
}

// fetchRealSubmissionStatusViaREST calls mod_assign_get_submission_status for an assignment.
func fetchRealSubmissionStatusViaREST(baseURL, wstoken string, assignid int64) (string, error) {
	status := "new"
	err := GlobalCircuitBreaker.Execute(func() error {
		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=mod_assign_get_submission_status&wstoken=%s&assignid=%d&moodlewsrestformat=json", baseURL, wstoken, assignid)
		resp, err := restGet(endpoint)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		bodyBytes, _ := io.ReadAll(resp.Body)
		var ssr restSubmissionStatusResponse
		if err := json.Unmarshal(bodyBytes, &ssr); err != nil {
			return err
		}

		if ssr.Exception != "" {
			return fmt.Errorf("Moodle submission exception: %s", ssr.Message)
		}

		if ssr.LastAttempt != nil && ssr.LastAttempt.Submission != nil {
			status = ssr.LastAttempt.Submission.Status
		}
		return nil
	})

	return status, err
}

// fetchAllAssignmentsViaREST retrieves all assignments for the given courses via mod_assign_get_assignments.
func fetchAllAssignmentsViaREST(baseURL, wstoken string, courseIDs []int64) ([]MoodleAssignmentDetail, error) {
	var assignments []MoodleAssignmentDetail
	err := GlobalCircuitBreaker.Execute(func() error {
		params := url.Values{"wstoken": {wstoken}, "moodlewsrestformat": {"json"}}
		for i, id := range courseIDs {
			params.Set(fmt.Sprintf("courseids[%d]", i), fmt.Sprintf("%d", id))
		}

		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=mod_assign_get_assignments&%s",
			baseURL, params.Encode())

		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("REST assignments network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read assignments response: %w", err)
		}

		var res MoodleGetAssignmentsResponse
		if err := json.Unmarshal(bodyBytes, &res); err != nil {
			return fmt.Errorf("failed to parse assignments JSON: %w", err)
		}

		if res.Exception != "" {
			return fmt.Errorf("Moodle assignments exception: %s", res.Message)
		}

		for _, course := range res.Courses {
			assignments = append(assignments, course.Assignments...)
		}
		return nil
	})

	return assignments, err
}

// fetchSubmissionsViaREST retrieves the submission status for all given assignment IDs.
func fetchSubmissionsViaREST(baseURL, wstoken string, assignIDs []int64) (map[int64]string, error) {
	submissionMap := make(map[int64]string)
	if len(assignIDs) == 0 {
		return submissionMap, nil
	}

	err := GlobalCircuitBreaker.Execute(func() error {
		params := url.Values{"wstoken": {wstoken}, "moodlewsrestformat": {"json"}}
		for i, id := range assignIDs {
			params.Set(fmt.Sprintf("assignmentids[%d]", i), fmt.Sprintf("%d", id))
		}

		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=mod_assign_get_submissions&%s",
			baseURL, params.Encode())

		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("REST submissions network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read submissions response: %w", err)
		}

		var res MoodleGetSubmissionsResponse
		if err := json.Unmarshal(bodyBytes, &res); err != nil {
			return fmt.Errorf("failed to parse submissions JSON: %w", err)
		}

		if res.Exception != "" {
			return fmt.Errorf("Moodle submissions exception: %s", res.Message)
		}

		for _, assignSub := range res.Assignments {
			// Get submission status for current user (or the first submission, as typically it's only the logged in user's)
			if len(assignSub.Submissions) > 0 {
				submissionMap[assignSub.AssignmentID] = assignSub.Submissions[0].Status
			} else {
				submissionMap[assignSub.AssignmentID] = "new"
			}
		}
		return nil
	})

	return submissionMap, err
}

// fetchQuizAttemptsViaREST calls mod_quiz_get_user_attempts to fetch user's attempts for a quiz.
func fetchQuizAttemptsViaREST(baseURL, wstoken string, quizID int64, moodleUserID int64) ([]moodleQuizAttempt, error) {
	var attempts []moodleQuizAttempt
	err := GlobalCircuitBreaker.Execute(func() error {
		endpoint := fmt.Sprintf("%s/webservice/rest/server.php?wsfunction=mod_quiz_get_user_attempts&wstoken=%s&quizid=%d&userid=%d&status=finished&moodlewsrestformat=json", baseURL, wstoken, quizID, moodleUserID)
		resp, err := restGet(endpoint)
		if err != nil {
			return fmt.Errorf("REST quiz attempts network error: %w", err)
		}
		defer resp.Body.Close()

		bodyBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read quiz attempts response: %w", err)
		}

		var res struct {
			Attempts  []moodleQuizAttempt `json:"attempts"`
			Exception string              `json:"exception,omitempty"`
			Message   string              `json:"message,omitempty"`
		}
		if err := json.Unmarshal(bodyBytes, &res); err != nil {
			return fmt.Errorf("failed to parse quiz attempts JSON: %w", err)
		}

		if res.Exception != "" {
			return fmt.Errorf("Moodle quiz attempts exception: %s", res.Message)
		}

		attempts = res.Attempts
		return nil
	})

	return attempts, err
}

// DebugScrapeREST executes a sync simulation via REST and returns diagnostic results (does not save to DB).
func DebugScrapeREST(db *gorm.DB, conn *models.MoodleConnection) DebugScrapeResult {
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

	baseURL := conn.MoodleBaseURL
	if baseURL == "" {
		baseURL = "https://welearn.wicida.ac.id"
	}

	token, err := loginViaToken(baseURL, conn.MoodleUsername, password)
	if err != nil {
		result.LoginSuccess = false
		result.LoginError = err.Error()
		return result
	}
	result.LoginSuccess = true

	uID, err := fetchUserIDViaREST(baseURL, token)
	if err != nil {
		result.SyncError = "Gagal fetch userid via REST: " + err.Error()
		return result
	}
	result.MoodleUserID = uID
	
	if len(token) >= 6 {
		result.Sesskey = "rest_" + token[:6] + "…"
	}

	courses, err := fetchCoursesViaREST(baseURL, token, uID)
	if err != nil {
		result.SyncError = "Gagal fetch courses via REST: " + err.Error()
		return result
	}
	result.CoursesFound = len(courses)

	activePrefix := config.AppConfig.ActiveSemesterPrefix
	for _, c := range courses {
		if activePrefix != "" && !strings.Contains(c.FullName, activePrefix) {
			continue
		}
		cID := fmt.Sprintf("%d", c.ID)
		sections, err := fetchCourseContentsViaREST(baseURL, token, cID)
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

