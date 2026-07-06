package welearn

import "encoding/json"

// Internal AJAX types
type ajaxRequest struct {
	Index      int            `json:"index"`
	MethodName string         `json:"methodname"`
	Args       map[string]any `json:"args"`
}

type ajaxEnvelopeItem struct {
	Error     bool            `json:"error"`
	Data      json.RawMessage `json:"data"`
	Exception *ajaxException  `json:"exception,omitempty"`
}

type ajaxException struct {
	Message   string `json:"message"`
	ErrorCode string `json:"errorcode"`
}

type moodleCourseItem struct {
	ID        int64  `json:"id"`
	FullName  string `json:"fullname"`
	ShortName string `json:"shortname"`
}

type moodleSectionItem struct {
	Name    string             `json:"name"`
	Modules []moodleModuleItem `json:"modules"`
}

type moodleModuleItem struct {
	ID             int64                 `json:"id"`
	Instance       int64                 `json:"instance"`
	Name           string                `json:"name"`
	ModName        string                `json:"modname"`
	URL            string                `json:"url"`
	UserVisible    bool                  `json:"uservisible"`
	CompletionData *moodleCompletionData `json:"completiondata,omitempty"`
	Dates          []moodleModuleDate    `json:"dates,omitempty"`
}

type moodleSubmissionStatusResponse struct {
	LastAttempt *moodleLastAttempt `json:"lastattempt,omitempty"`
}

type moodleLastAttempt struct {
	Submission *moodleSubmission `json:"submission,omitempty"`
}

type moodleSubmission struct {
	ID     int64  `json:"id"`
	UserID int64  `json:"userid"`
	Status string `json:"status"` // submitted, draft, new
}

type moodleCompletionData struct {
	State int `json:"state"` // 0=incomplete 1=complete 2=complete_pass 3=complete_fail
}

type moodleQuizAttempt struct {
	ID    int64  `json:"id"`
	State string `json:"state"` // inprogress, finished, etc.
}

type moodleModuleDate struct {
	Label     string `json:"label"`
	Timestamp int64  `json:"timestamp"`
}

type cookieEntry struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type sessionInfo struct {
	Sesskey string
	UserID  int64
}

// REST API Data Types
type moodleTokenResponse struct {
	Token      string `json:"token"`
	Error      string `json:"error,omitempty"`
	ErrorCode  string `json:"errorcode,omitempty"`
	Stacktrace string `json:"stacktrace,omitempty"`
	DebugInfo  string `json:"debuginfo,omitempty"`
	Message    string `json:"message,omitempty"`
}

type moodleSiteInfoResponse struct {
	UserID    int64  `json:"userid"`
	Username  string `json:"username"`
	FullName  string `json:"fullname"`
	Exception string `json:"exception,omitempty"`
	Message   string `json:"message,omitempty"`
}

type restSubmissionStatusResponse struct {
	LastAttempt *restLastAttempt `json:"lastattempt,omitempty"`
	Exception   string           `json:"exception,omitempty"`
	Message     string           `json:"message,omitempty"`
}

type restLastAttempt struct {
	Submission *restSubmission `json:"submission,omitempty"`
}

type restSubmission struct {
	ID     int64  `json:"id"`
	UserID int64  `json:"userid"`
	Status string `json:"status"` // submitted, draft, new
}

// DebugScrapeResult contains diagnostic results.
type DebugScrapeResult struct {
	LoginSuccess    bool   `json:"loginSuccess"`
	LoginError      string `json:"loginError,omitempty"`
	MoodleUserID    int64  `json:"moodleUserId,omitempty"`
	Sesskey         string `json:"sesskey,omitempty"`
	CoursesFound    int    `json:"coursesFound"`
	ActivitiesFound int    `json:"activitiesFound"`
	SyncError       string `json:"syncError,omitempty"`
}

// MoodleAssignmentDetail is used for mod_assign_get_assignments (Phase 2)
type MoodleAssignmentDetail struct {
	ID            int64   `json:"id"`
	CourseID      int64   `json:"course"`
	Name          string  `json:"name"`
	Intro         string  `json:"intro"`
	DueDate       int64   `json:"duedate"`
	CutOffDate    int64   `json:"cutoffdate"`
	GradeMax      float64 `json:"grade"`
	NoSubmissions int     `json:"nosubmissions"`
}

// MoodleGetAssignmentsResponse is the envelope for mod_assign_get_assignments
type MoodleGetAssignmentsResponse struct {
	Courses   []MoodleCourseAssignments `json:"courses"`
	Exception string                    `json:"exception,omitempty"`
	Message   string                    `json:"message,omitempty"`
}

type MoodleCourseAssignments struct {
	ID          int64                    `json:"id"`
	Shortname   string                   `json:"shortname"`
	Fullname    string                   `json:"fullname"`
	Assignments []MoodleAssignmentDetail `json:"assignments"`
}

// MoodleGetSubmissionsResponse is the envelope for mod_assign_get_submissions
type MoodleGetSubmissionsResponse struct {
	Assignments []MoodleAssignmentSubmissions `json:"assignments"`
	Exception   string                        `json:"exception,omitempty"`
	Message     string                        `json:"message,omitempty"`
}

type MoodleAssignmentSubmissions struct {
	AssignmentID int64                    `json:"assignmentid"`
	Submissions  []MoodleSubmissionDetail `json:"submissions"`
}

type MoodleSubmissionDetail struct {
	ID     int64  `json:"id"`
	UserID int64  `json:"userid"`
	Status string `json:"status"` // submitted, draft, new
}

type MoodleCalendarEvent struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	CourseID     int64  `json:"courseid"`
	TimeStart    int64  `json:"timestart"`
	TimeDuration int64  `json:"timeduration"`
	Visible      int    `json:"visible"`
}

type MoodleCalendarEventsResponse struct {
	Events    []MoodleCalendarEvent `json:"events"`
	Exception string                `json:"exception,omitempty"`
	Message   string                `json:"message,omitempty"`
}


