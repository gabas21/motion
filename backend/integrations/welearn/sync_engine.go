package welearn

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/motion/backend/config"
	"github.com/motion/backend/models"
	"github.com/motion/backend/pkg/utils"
	"gorm.io/gorm"
)

var (
	syncMutexes = make(map[uuid.UUID]*sync.Mutex)
	globalLock  sync.Mutex
)

// Callbacks to prevent circular dependencies with package services
var (
	BroadcastCallback    func(userID string, message []byte)
	ScheduleTaskCallback func(task *models.Task)
	IngestRAGCallback    func(userID uuid.UUID, courseName string, assignName string, introHTML string)
)

func getSyncMutex(connID uuid.UUID) *sync.Mutex {
	globalLock.Lock()
	defer globalLock.Unlock()
	if m, ok := syncMutexes[connID]; ok {
		return m
	}
	m := &sync.Mutex{}
	syncMutexes[connID] = m
	return m
}

var (
	mirrorMutexes    = make(map[uuid.UUID]*sync.Mutex)
	mirrorGlobalLock sync.Mutex
)

func getMirrorMutex(userID uuid.UUID) *sync.Mutex {
	mirrorGlobalLock.Lock()
	defer mirrorGlobalLock.Unlock()
	if m, ok := mirrorMutexes[userID]; ok {
		return m
	}
	m := &sync.Mutex{}
	mirrorMutexes[userID] = m
	return m
}

// SyncViaREST executes REST-based course and task synchronization with batch optimizations.
// Fallback automatically to SyncViaAJAX if REST services fail or are restricted.
func SyncViaREST(db *gorm.DB, conn *models.MoodleConnection, activeSession *WeLearnSession) error {
	mutex := getSyncMutex(conn.ID)
	mutex.Lock()
	defer mutex.Unlock()

	log.Printf("[welearn-rest] Memulai sinkronisasi REST untuk user %s...", conn.UserID)

	err := syncViaRESTInternal(db, conn)
	if err != nil {
		log.Printf("[welearn-rest] ⚠ REST sync gagal (%v). Mencoba fallback ke AJAX sync...", err)
		return SyncViaAJAX(db, conn, activeSession)
	}
	return nil
}

func syncViaRESTInternal(db *gorm.DB, conn *models.MoodleConnection) error {
	password, err := utils.DecryptWithSalt(conn.EncryptedPassword, conn.UserID.String())
	if err != nil {
		passwordOld, errOld := utils.DecryptPassword(conn.EncryptedPassword)
		if errOld != nil {
			return fmt.Errorf("gagal dekripsi password (salted: %v, old: %v)", err, errOld)
		}
		password = passwordOld
	}

	baseURL := conn.MoodleBaseURL
	if baseURL == "" {
		baseURL = "https://welearn.wicida.ac.id"
	}

	var wstoken string
	var moodleUserID int64
	now := time.Now()

	cacheValid := conn.CachedSesskey != "" &&
		conn.CachedMoodleUserID != 0 &&
		conn.CachedSessionExpiry != nil &&
		conn.CachedSessionExpiry.After(now) &&
		strings.HasPrefix(conn.CachedSesskey, "rest_")

	if cacheValid {
		wstoken = strings.TrimPrefix(conn.CachedSesskey, "rest_")
		moodleUserID = conn.CachedMoodleUserID
		log.Printf("[welearn-rest] Menggunakan cached REST token (valid s/d %s)", conn.CachedSessionExpiry.Format(time.RFC3339))
	} else {
		token, tokenErr := loginViaToken(baseURL, conn.MoodleUsername, password)
		if tokenErr != nil {
			log.Printf("[welearn-rest] ⚠ Gagal login token Moodle: %v", tokenErr)
			return fmt.Errorf("gagal login token Moodle: %w", tokenErr)
		}

		uID, uIDErr := fetchUserIDViaREST(baseURL, token)
		if uIDErr != nil {
			log.Printf("[welearn-rest] ⚠ Gagal fetch userid via REST: %v", uIDErr)
			return fmt.Errorf("gagal mengambil user ID Moodle via REST: %w", uIDErr)
		}

		wstoken = token
		moodleUserID = uID
		expiry := time.Now().Add(12 * time.Hour)

		if dbErr := db.Model(&models.MoodleConnection{}).
			Where("id = ?", conn.ID).
			Updates(map[string]any{
				"cached_sesskey":        "rest_" + wstoken,
				"cached_session_expiry": expiry,
				"cached_moodle_user_id": moodleUserID,
			}).Error; dbErr != nil {
			log.Printf("[welearn-rest] ⚠ Gagal simpan cache REST ke DB: %v", dbErr)
		}
		log.Printf("[welearn-rest] Sesi REST disimpan — userid=%d, berlaku s/d %s", moodleUserID, expiry.Format(time.RFC3339))
	}

	activePrefix := config.AppConfig.ActiveSemesterPrefix

	// Pindahkan cleanup ke awal sync
	if activePrefix != "" {
		parts := strings.Split(activePrefix, "_")
		yearPrefix := parts[0]
		db.Where("user_id = ? AND course_name NOT LIKE ?", conn.UserID, "%"+yearPrefix+"%").Delete(&models.MoodleAssignment{})
		db.Where("user_id = ? AND name NOT LIKE ?", conn.UserID, "%"+yearPrefix+"%").Delete(&models.MoodleCourse{})
	}

	var existingMoodleAssignments []models.MoodleAssignment
	if err := db.Where("user_id = ?", conn.UserID).Find(&existingMoodleAssignments).Error; err != nil {
		log.Printf("[welearn-rest] Warning: gagal load existing moodle assignments: %v", err)
	}
	alreadySubmittedMap := make(map[string]bool)
	for i := range existingMoodleAssignments {
		a := &existingMoodleAssignments[i]
		if a.SubmissionStatus == "submitted" {
			alreadySubmittedMap[a.MoodleAssignID] = true
		}
	}

	var courses []moodleCourseItem
	// Retry loop for fetching courses (up to 2 retries)
	for attempt := 0; attempt <= 2; attempt++ {
		courses, err = fetchCoursesViaREST(baseURL, wstoken, moodleUserID)
		if err == nil {
			break
		}
		if attempt < 2 {
			delay := time.Second
			if attempt == 1 {
				delay = 3 * time.Second
			}
			log.Printf("[welearn-rest] ⚠ Gagal fetch courses (percobaan %d/3): %v. Menunggu %v...", attempt+1, err, delay)
			time.Sleep(delay)
		}
	}

	if err != nil {
		log.Printf("[welearn-rest] ⚠ Gagal fetch courses: %v. Hapus cache token dan coba login ulang...", err)
		
		db.Model(&models.MoodleConnection{}).Where("id = ?", conn.ID).Updates(map[string]any{
			"cached_sesskey": "",
		})
		
		token, tokenErr := loginViaToken(baseURL, conn.MoodleUsername, password)
		if tokenErr != nil {
			return fmt.Errorf("login ulang REST gagal: %w", tokenErr)
		}
		uID, _ := fetchUserIDViaREST(baseURL, token)
		wstoken = token
		moodleUserID = uID

		// Retry loop after logging in again
		for attempt := 0; attempt <= 2; attempt++ {
			courses, err = fetchCoursesViaREST(baseURL, wstoken, moodleUserID)
			if err == nil {
				break
			}
			if attempt < 2 {
				delay := time.Second
				if attempt == 1 {
					delay = 3 * time.Second
				}
				log.Printf("[welearn-rest] ⚠ Gagal fetch courses setelah login ulang (percobaan %d/3): %v. Menunggu %v...", attempt+1, err, delay)
				time.Sleep(delay)
			}
		}
		if err != nil {
			return fmt.Errorf("fetch courses REST tetap gagal setelah login ulang: %w", err)
		}
	}

	var targetCourses []moodleCourseItem
	var targetCourseIDs []int64
	for _, c := range courses {
		if activePrefix != "" && !strings.Contains(c.FullName, activePrefix) {
			log.Printf("[welearn-rest] Lewati matkul semester lama: %s", c.FullName)
			continue
		}
		targetCourses = append(targetCourses, c)
		targetCourseIDs = append(targetCourseIDs, c.ID)
	}
	log.Printf("[welearn-rest] Memproses %d/%d matkul semester berjalan (%q)", len(targetCourses), len(courses), activePrefix)

	// Fetch sections/activities for each course in parallel to identify quizzes, forums, and modules
	type courseResult struct {
		courseID   string
		courseName string
		activities []moodleModuleItem
		sectionMap map[int64]string
		err        error
	}

	resultsCh := make(chan courseResult, len(targetCourses))
	var wg sync.WaitGroup

	for _, c := range targetCourses {
		wg.Add(1)
		go func(course moodleCourseItem) {
			defer wg.Done()
			
			cID := fmt.Sprintf("%d", course.ID)
			var sections []moodleSectionItem
			var err error
			
			// Retry fetching contents up to 2 times
			for attempt := 0; attempt <= 2; attempt++ {
				sections, err = fetchCourseContentsViaREST(baseURL, wstoken, cID)
				if err == nil {
					break
				}
				if attempt < 2 {
					delay := time.Second
					if attempt == 1 {
						delay = 3 * time.Second
					}
					log.Printf("[welearn-rest] ⚠ Gagal fetch contents untuk matkul %s (percobaan %d/3): %v. Menunggu %v...", course.FullName, attempt+1, err, delay)
					time.Sleep(delay)
				}
			}

			if err != nil {
				resultsCh <- courseResult{err: fmt.Errorf("gagal fetch contents untuk %s: %w", course.FullName, err)}
				return
			}

			var activities []moodleModuleItem
			sMap := make(map[int64]string)
			for _, sec := range sections {
				secName := cleanSectionName(sec.Name)
				for _, mod := range sec.Modules {
					if !mod.UserVisible {
						continue
					}
					if mod.ModName != "assign" && mod.ModName != "quiz" && mod.ModName != "forum" {
						continue
					}
					sMap[mod.ID] = secName
					activities = append(activities, mod)
				}
			}

			resultsCh <- courseResult{
				courseID:   cID,
				courseName: course.FullName,
				activities: activities,
				sectionMap: sMap,
			}
		}(c)
	}

	go func() {
		wg.Wait()
		close(resultsCh)
	}()

	// Read course details and compile all active assignment instance IDs
	var processedResults []courseResult
	var assignInstanceIDs []int64

	for res := range resultsCh {
		if res.err != nil {
			log.Printf("[welearn-rest] ⚠ %v", res.err)
			continue
		}
		processedResults = append(processedResults, res)

		for _, mod := range res.activities {
			if mod.ModName == "assign" && mod.Instance > 0 {
				modID := fmt.Sprintf("%d", mod.ID)
				if !alreadySubmittedMap[modID] {
					assignInstanceIDs = append(assignInstanceIDs, mod.Instance)
				}
			}
		}
	}

	// Fetch student submissions for assignments and quizzes to determine status
	var submissionMap map[int64]string
	var subErr error

	if len(assignInstanceIDs) > 0 {
		// Retry fetching submissions up to 2 times
		for attempt := 0; attempt <= 2; attempt++ {
			submissionMap, subErr = fetchSubmissionsViaREST(baseURL, wstoken, assignInstanceIDs)
			if subErr == nil {
				break
			}
			if attempt < 2 {
				delay := time.Second
				if attempt == 1 {
					delay = 3 * time.Second
				}
				time.Sleep(delay)
			}
		}
		if subErr != nil {
			log.Printf("[welearn-rest] Warning: gagal fetch submissions: %v", subErr)
		}
	}

	quizAttemptsMap := make(map[int64]string)
	var quizWg sync.WaitGroup
	var quizMutex sync.Mutex

	for _, res := range processedResults {
		for _, mod := range res.activities {
			if mod.ModName == "quiz" && mod.Instance > 0 {
				mID := fmt.Sprintf("%d", mod.ID)
				if alreadySubmittedMap[mID] {
					continue
				}
				quizWg.Add(1)
				go func(qInstance int64, qName string) {
					defer quizWg.Done()
					var attempts []moodleQuizAttempt
					var quizErr error
					// Retry fetching quiz attempts up to 2 times
					for attempt := 0; attempt <= 2; attempt++ {
						attempts, quizErr = fetchQuizAttemptsViaREST(baseURL, wstoken, qInstance, moodleUserID)
						if quizErr == nil {
							break
						}
						if attempt < 2 {
							delay := time.Second
							if attempt == 1 {
								delay = 3 * time.Second
							}
							time.Sleep(delay)
						}
					}
					if quizErr != nil {
						log.Printf("[welearn-rest] Warning: gagal fetch quiz attempts untuk %s (id=%d): %v", qName, qInstance, quizErr)
						return
					}

					hasFinished := false
					for _, att := range attempts {
						if att.State == "finished" {
							hasFinished = true
							break
						}
					}
					quizMutex.Lock()
					if hasFinished {
						quizAttemptsMap[qInstance] = "submitted"
					} else {
						quizAttemptsMap[qInstance] = "new"
					}
					quizMutex.Unlock()
				}(mod.Instance, mod.Name)
			}
		}
	}
	quizWg.Wait()

	// Ingest assignment descriptions for RAG (Fase 1)
	assignIntroMap := make(map[int64]string)
	if len(targetCourseIDs) > 0 {
		assignmentsWithDetail, detailsErr := fetchAllAssignmentsViaREST(baseURL, wstoken, targetCourseIDs)
		if detailsErr == nil {
			for _, a := range assignmentsWithDetail {
				assignIntroMap[a.ID] = a.Intro
			}
		} else {
			log.Printf("[welearn-rest] Warning: gagal fetch all assignments details: %v", detailsErr)
		}
	}

	totalSaved := 0
	for _, res := range processedResults {
		// Upsert course
		var courseRecord models.MoodleCourse
		courseAttrs := models.MoodleCourse{
			UserID:         conn.UserID,
			MoodleCourseID: res.courseID,
			Name:           res.courseName,
		}
		if err := db.Where(models.MoodleCourse{
			UserID:         conn.UserID,
			MoodleCourseID: res.courseID,
		}).Assign(courseAttrs).FirstOrCreate(&courseRecord).Error; err != nil {
			log.Printf("[welearn-rest] ⚠ Gagal upsert matkul %s: %v", res.courseID, err)
		}

		// Upsert assignments
		for _, mod := range res.activities {
			modID := fmt.Sprintf("%d", mod.ID)

			realStatus := "new"
			if alreadySubmittedMap[modID] {
				realStatus = "submitted"
			} else if subStatus, ok := submissionMap[mod.Instance]; ok && mod.ModName == "assign" {
				switch subStatus {
				case "submitted":
					realStatus = "submitted"
				case "draft":
					realStatus = "draft"
				default:
					realStatus = "new"
				}
			} else if subStatus, ok := quizAttemptsMap[mod.Instance]; ok && mod.ModName == "quiz" {
				if subStatus == "submitted" {
					realStatus = "submitted"
				} else {
					realStatus = "new"
				}
			} else {
				realStatus = resolveCompletionStatus(mod)
			}

			dueTimePtr := (*time.Time)(nil)
			if dueTime := extractDueDateFromModule(mod); !dueTime.IsZero() {
				dueTimePtr = &dueTime
			}

			var assignmentRecord models.MoodleAssignment
			assignmentAttrs := models.MoodleAssignment{
				UserID:           conn.UserID,
				MoodleAssignID:   modID,
				CourseID:         res.courseID,
				CourseName:       res.courseName,
				Name:             mod.Name,
				EventType:        mod.ModName,
				SubmissionStatus: realStatus,
				SectionName:      res.sectionMap[mod.ID],
				URL:              mod.URL,
				DueDate:          dueTimePtr,
			}
			if err := db.Where(models.MoodleAssignment{
				UserID:         conn.UserID,
				MoodleAssignID: modID,
			}).Assign(assignmentAttrs).FirstOrCreate(&assignmentRecord).Error; err != nil {
				log.Printf("[welearn-rest] ⚠ Gagal upsert tugas %q: %v", mod.Name, err)
			} else {
				totalSaved++
				if IngestRAGCallback != nil && mod.ModName == "assign" {
					if intro, ok := assignIntroMap[mod.Instance]; ok && intro != "" {
						IngestRAGCallback(conn.UserID, res.courseName, mod.Name, intro)
					}
				}
			}
		}
	}

	// Update sync timestamp
	nowTime := time.Now()
	if err := db.Model(&models.MoodleConnection{}).
		Where("id = ?", conn.ID).
		Update("last_sync_at", nowTime).Error; err != nil {
		log.Printf("[welearn-rest] ⚠ Gagal update last_sync_at: %v", err)
	}

	if err := MirrorWeLearnAssignmentsToTasks(db, conn.UserID); err != nil {
		log.Printf("[welearn-rest] ⚠ Gagal mencerminkan tugas WeLearn ke tabel tugas: %v", err)
	}

	// Sinkronisasi Kalender Akademik Moodle (Fase 6)
	if err := SyncMoodleCalendarEvents(db, baseURL, wstoken, targetCourseIDs, conn.UserID); err != nil {
		log.Printf("[welearn-rest] ⚠ Gagal sinkronisasi kalender akademik Moodle: %v", err)
	}

	if BroadcastCallback != nil {
		BroadcastCallback(conn.UserID.String(), []byte(`{"type":"TASK_UPDATED"}`))
	}

	log.Printf("[welearn-rest] ✓ Sync REST selesai: user=%s, %d aktivitas tersimpan.", conn.UserID, totalSaved)
	return nil
}

// SyncViaAJAX executes full AJAX-based synchronization.
func SyncViaAJAX(db *gorm.DB, conn *models.MoodleConnection, activeSession *WeLearnSession) error {
	password, err := utils.DecryptWithSalt(conn.EncryptedPassword, conn.UserID.String())
	if err != nil {
		passwordOld, errOld := utils.DecryptPassword(conn.EncryptedPassword)
		if errOld != nil {
			return fmt.Errorf("gagal dekripsi password (salted: %v, old: %v)", err, errOld)
		}
		password = passwordOld
	}
	
	var session *WeLearnSession
	if activeSession != nil {
		session = activeSession
		log.Println("[welearn-ajax] Menggunakan sesi terverifikasi yang dilewatkan — skip login baru")
	} else {
		session = NewWeLearnSession(conn.MoodleUsername, password, conn.MoodleBaseURL)
	}

	sesskey, moodleUserID, err := resolveSession(db, conn, session)
	if err != nil {
		return fmt.Errorf("gagal mendapatkan sesi: %w", err)
	}

	activePrefix := config.AppConfig.ActiveSemesterPrefix

	// Pindahkan cleanup ke awal sync
	if activePrefix != "" {
		parts := strings.Split(activePrefix, "_")
		yearPrefix := parts[0]
		db.Where("user_id = ? AND course_name NOT LIKE ?", conn.UserID, "%"+yearPrefix+"%").Delete(&models.MoodleAssignment{})
		db.Where("user_id = ? AND name NOT LIKE ?", conn.UserID, "%"+yearPrefix+"%").Delete(&models.MoodleCourse{})
	}

	courses, err := fetchCoursesViaAJAX(session, sesskey, moodleUserID)
	if err != nil {
		if isSessionExpiredError(err) {
			log.Printf("[welearn-ajax] Sesi kedaluwarsa saat fetch courses, login ulang sekarang...")
			sesskey, moodleUserID, err = forceRefreshSession(db, conn, session)
			if err != nil {
				return fmt.Errorf("login ulang gagal: %w", err)
			}
			courses, err = fetchCoursesViaAJAX(session, sesskey, moodleUserID)
			if err != nil {
				return fmt.Errorf("fetch courses tetap gagal setelah login ulang: %w", err)
			}
		} else {
			return err
		}
	}

	var targetCourses []moodleCourseItem
	for _, c := range courses {
		if activePrefix != "" && !strings.Contains(c.FullName, activePrefix) {
			log.Printf("[welearn-ajax] Lewati matkul semester lama: %s", c.FullName)
			continue
		}
		targetCourses = append(targetCourses, c)
	}
	log.Printf("[welearn-ajax] %d/%d matkul akan diproses (semester filter: %q)", len(targetCourses), len(courses), activePrefix)

	type courseResult struct {
		courseID      string
		courseName    string
		activities    []moodleModuleItem
		sectionMap    map[int64]string
		submissionMap map[int64]string
		err           error
	}

	resultsCh := make(chan courseResult, len(targetCourses))
	var wg sync.WaitGroup

	for _, c := range targetCourses {
		wg.Add(1)
		go func(course moodleCourseItem) {
			defer wg.Done()

			time.Sleep(time.Duration(100+(course.ID%300)) * time.Millisecond)

			cID := fmt.Sprintf("%d", course.ID)
			sections, err := fetchCourseContentsViaAJAX(session, sesskey, cID)
			if err != nil {
				resultsCh <- courseResult{err: fmt.Errorf("course %q (id=%s): %w", course.FullName, cID, err)}
				return
			}

			var activities []moodleModuleItem
			sMap := map[int64]string{}
			for _, sec := range sections {
				secName := cleanSectionName(sec.Name)
				for _, mod := range sec.Modules {
					if !mod.UserVisible {
						continue
					}
					if mod.ModName != "assign" && mod.ModName != "quiz" && mod.ModName != "forum" {
						continue
					}
					sMap[mod.ID] = secName
					activities = append(activities, mod)
				}
			}

			var batchReqs []ajaxRequest
			assignIndices := make(map[int]int)
			
			for idx, mod := range activities {
				if mod.ModName == "assign" && mod.Instance > 0 {
					reqIdx := len(batchReqs)
					assignIndices[reqIdx] = idx
					batchReqs = append(batchReqs, ajaxRequest{
						Index:      reqIdx,
						MethodName: "mod_assign_get_submission_status",
						Args: map[string]any{
							"assignid": mod.Instance,
						},
					})
				} else if mod.ModName == "quiz" && mod.Instance > 0 {
					reqIdx := len(batchReqs)
					assignIndices[reqIdx] = idx
					batchReqs = append(batchReqs, ajaxRequest{
						Index:      reqIdx,
						MethodName: "mod_quiz_get_user_attempts",
						Args: map[string]any{
							"quizid": mod.Instance,
							"userid": moodleUserID,
							"status": "finished",
						},
					})
				}
			}

			submissionMap := make(map[int64]string)
			if len(batchReqs) > 0 {
				envelope, err := session.callAJAX(sesskey, batchReqs)
				if err == nil && len(envelope) == len(batchReqs) {
					for reqIdx, item := range envelope {
						if item.Error {
							continue
						}
						actIdx := assignIndices[reqIdx]
						mod := activities[actIdx]
						
						if mod.ModName == "assign" {
							var subResp moodleSubmissionStatusResponse
							if json.Unmarshal(item.Data, &subResp) == nil {
								if subResp.LastAttempt != nil && subResp.LastAttempt.Submission != nil {
									realStatus := subResp.LastAttempt.Submission.Status
									modID := mod.ID
									submissionMap[modID] = realStatus
									log.Printf("[welearn-ajax] Real status for assignment %s (id=%d, assignid=%d): %s", mod.Name, modID, mod.Instance, realStatus)
								}
							}
						} else if mod.ModName == "quiz" {
							var quizResp struct {
								Attempts []moodleQuizAttempt `json:"attempts"`
							}
							if json.Unmarshal(item.Data, &quizResp) == nil {
								hasFinished := false
								for _, attempt := range quizResp.Attempts {
									if attempt.State == "finished" {
										hasFinished = true
										break
									}
								}
								modID := mod.ID
								if hasFinished {
									submissionMap[modID] = "submitted"
									log.Printf("[welearn-ajax] Real status for quiz %s (id=%d, quizid=%d): submitted", mod.Name, modID, mod.Instance)
								} else {
									submissionMap[modID] = "new"
									log.Printf("[welearn-ajax] Real status for quiz %s (id=%d, quizid=%d): new", mod.Name, modID, mod.Instance)
								}
							}
						}
					}
				} else if err != nil {
					log.Printf("[welearn-ajax] Warning: failed to fetch real submission status for course %s: %v", course.FullName, err)
				}
			}

			resultsCh <- courseResult{
				courseID:      cID,
				courseName:    course.FullName,
				activities:    activities,
				sectionMap:    sMap,
				submissionMap: submissionMap,
			}
		}(c)
	}

	go func() {
		wg.Wait()
		close(resultsCh)
	}()

	totalSaved := 0
	for res := range resultsCh {
		if res.err != nil {
			log.Printf("[welearn-ajax] ⚠ %v", res.err)
			continue
		}

		var courseRecord models.MoodleCourse
		courseAttrs := models.MoodleCourse{
			UserID:         conn.UserID,
			MoodleCourseID: res.courseID,
			Name:           res.courseName,
		}
		if err := db.Where(models.MoodleCourse{
			UserID:         conn.UserID,
			MoodleCourseID: res.courseID,
		}).Assign(courseAttrs).FirstOrCreate(&courseRecord).Error; err != nil {
			log.Printf("[welearn-ajax] ⚠ Gagal upsert matkul %s: %v", res.courseID, err)
		}

		for _, mod := range res.activities {
			modID := fmt.Sprintf("%d", mod.ID)
			
			realStatus := "new"
			if subStatus, ok := res.submissionMap[mod.ID]; ok {
				switch subStatus {
				case "submitted":
					realStatus = "submitted"
				case "draft":
					realStatus = "draft"
				default:
					realStatus = "new"
				}
			} else {
				realStatus = resolveCompletionStatus(mod)
			}

			var assignmentRecord models.MoodleAssignment
			assignmentAttrs := models.MoodleAssignment{
				UserID:           conn.UserID,
				MoodleAssignID:   modID,
				CourseID:         res.courseID,
				CourseName:       res.courseName,
				Name:             mod.Name,
				EventType:        mod.ModName,
				SubmissionStatus: realStatus,
				SectionName:      res.sectionMap[mod.ID],
				URL:              mod.URL,
			}
			if dueTime := extractDueDateFromModule(mod); !dueTime.IsZero() {
				assignmentAttrs.DueDate = &dueTime
			}

			if err := db.Where(models.MoodleAssignment{
				UserID:         conn.UserID,
				MoodleAssignID: modID,
			}).Assign(assignmentAttrs).FirstOrCreate(&assignmentRecord).Error; err != nil {
				log.Printf("[welearn-ajax] ⚠ Gagal upsert tugas %q: %v", mod.Name, err)
				continue
			}
			totalSaved++
		}
	}

	now := time.Now()
	if err := db.Model(&models.MoodleConnection{}).
		Where("id = ?", conn.ID).
		Update("last_sync_at", now).Error; err != nil {
		log.Printf("[welearn-ajax] ⚠ Gagal update last_sync_at: %v", err)
	}

	if err := MirrorWeLearnAssignmentsToTasks(db, conn.UserID); err != nil {
		log.Printf("[welearn-ajax] ⚠ Gagal mencerminkan tugas WeLearn ke tabel tugas: %v", err)
	}

	if BroadcastCallback != nil {
		BroadcastCallback(conn.UserID.String(), []byte(`{"type":"TASK_UPDATED"}`))
	}

	log.Printf("[welearn-ajax] ✓ Sync selesai: user=%s, %d aktivitas tersimpan.", conn.UserID, totalSaved)
	return nil
}

// SyncUserAssignmentsInternal is a helper function that triggers SyncViaREST.
func SyncUserAssignmentsInternal(db *gorm.DB, activeSession *WeLearnSession, userID, connID uuid.UUID) {
	var conn models.MoodleConnection
	if err := db.Where("id = ? AND user_id = ?", connID, userID).First(&conn).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			log.Printf("[welearn] SyncUserAssignmentsInternal: gagal load conn %s: %v", connID, err)
		}
		return
	}
	if err := SyncViaREST(db, &conn, activeSession); err != nil {
		log.Printf("[welearn] SyncUserAssignmentsInternal: sync gagal user %s: %v", userID, err)
	}
}

// MirrorWeLearnAssignmentsToTasks mirrors Moodle assignments to the main tasks table.
func MirrorWeLearnAssignmentsToTasks(db *gorm.DB, userID uuid.UUID) error {
	mutex := getMirrorMutex(userID)
	mutex.Lock()
	defer mutex.Unlock()

	var assignments []models.MoodleAssignment
	query := db.Where("user_id = ?", userID)
	if config.AppConfig.AcademicYearPrefix != "" {
		query = query.Where("course_name LIKE ?", "%"+config.AppConfig.AcademicYearPrefix+"%")
	}
	if err := query.Find(&assignments).Error; err != nil {
		return fmt.Errorf("gagal mengambil data moodle_assignments: %w", err)
	}

	var existingTasks []models.Task
	if err := db.Where("user_id = ? AND description LIKE '%[welearn-assign-id:%'", userID).Find(&existingTasks).Error; err != nil {
		log.Printf("[welearn-mirror] Warning: gagal load existing tasks: %v", err)
	}

	existingTasksMap := make(map[string]*models.Task)
	re := regexp.MustCompile(`\[welearn-assign-id:\s*([^\]]+)\]`)
	for i := range existingTasks {
		t := &existingTasks[i]
		matches := re.FindStringSubmatch(t.Description)
		if len(matches) > 1 {
			assignID := strings.TrimSpace(matches[1])
			existingTasksMap[assignID] = t
		}
	}

	for _, a := range assignments {
		isSubmittable := requiresSubmission(a.Name, a.EventType)
		if !isSubmittable && a.DueDate == nil {
			continue
		}

		taskCategory := "education"
		if !isSubmittable {
			taskCategory = "education_reminder"
		}

		welearnTag := fmt.Sprintf("[welearn-assign-id: %s]", a.MoodleAssignID)
		cleanCourse := CleanCourseName(a.CourseName)
		taskTitle := fmt.Sprintf("[WeLearn] %s: %s", cleanCourse, a.Name)
		if len(taskTitle) > 255 {
			taskTitle = taskTitle[:252] + "..."
		}

		taskStatus := "pending"
		var completedAt *time.Time
		if a.SubmissionStatus == "submitted" {
			taskStatus = "completed"
			now := time.Now()
			completedAt = &now
		}

		taskDescription := fmt.Sprintf("Mata Kuliah: %s\nPertemuan/Section: %s\nLink: %s\n\n%s", 
			a.CourseName, a.SectionName, a.URL, welearnTag)

		if existingTask, ok := existingTasksMap[a.MoodleAssignID]; ok {
			statusChanged := false
			if taskStatus == "completed" && existingTask.Status != "completed" {
				existingTask.Status = "completed"
				existingTask.CompletedAt = completedAt
				statusChanged = true
			} else if taskStatus == "pending" && existingTask.Status != "completed" && existingTask.Status != "pending" {
				existingTask.Status = "pending"
				statusChanged = true
			}

			dueDateChanged := false
			if (existingTask.DueDate == nil && a.DueDate != nil) || (existingTask.DueDate != nil && a.DueDate == nil) {
				dueDateChanged = true
			} else if existingTask.DueDate != nil && a.DueDate != nil && !existingTask.DueDate.Equal(*a.DueDate) {
				dueDateChanged = true
			}

			if existingTask.Title != taskTitle || existingTask.Description != taskDescription || dueDateChanged || statusChanged || existingTask.Category != taskCategory {
				existingTask.Title = taskTitle
				existingTask.Description = taskDescription
				existingTask.DueDate = a.DueDate
				existingTask.Category = taskCategory

				if taskCategory == "education_reminder" && a.DueDate != nil {
					existingTask.ScheduledStart = a.DueDate
					endVal := a.DueDate.Add(30 * time.Minute)
					existingTask.ScheduledEnd = &endVal
					existingTask.Status = "scheduled"
					if a.DueDate.After(time.Now()) {
						existingTask.ReminderSent = false
					} else {
						existingTask.ReminderSent = true
					}
				}

				if err := db.Save(existingTask).Error; err != nil {
					log.Printf("[welearn-mirror] ⚠ Gagal memperbarui tugas cerminan %s: %v", existingTask.ID, err)
				}
			}
		} else {
			var schStart, schEnd *time.Time
			reminderSent := false
			if taskCategory == "education_reminder" && a.DueDate != nil {
				schStart = a.DueDate
				endVal := a.DueDate.Add(30 * time.Minute)
				schEnd = &endVal
				taskStatus = "scheduled"
				if a.DueDate.Before(time.Now()) {
					reminderSent = true
				}
			}

			newTask := models.Task{
				UserID:              userID,
				Title:               taskTitle,
				Description:         taskDescription,
				TimeEstimateMinutes: 60,
				DueDate:             a.DueDate,
				Priority:            4,
				Status:              taskStatus,
				CompletedAt:         completedAt,
				Category:            taskCategory,
				ScheduledStart:      schStart,
				ScheduledEnd:        schEnd,
				ReminderSent:        reminderSent,
			}
			
			if err := db.Create(&newTask).Error; err != nil {
				log.Printf("[welearn-mirror] ⚠ Gagal membuat tugas cerminan baru %s: %v", a.MoodleAssignID, err)
			} else {
				if newTask.Status == "pending" && taskCategory == "education" {
					if ScheduleTaskCallback != nil {
						ScheduleTaskCallback(&newTask)
					}
				}
			}
		}
	}

	activeAssignIDs := make(map[string]bool)
	for _, a := range assignments {
		isSubmittable := requiresSubmission(a.Name, a.EventType)
		if isSubmittable || a.DueDate != nil {
			activeAssignIDs[a.MoodleAssignID] = true
		}
	}

	for _, t := range existingTasks {
		matches := re.FindStringSubmatch(t.Description)
		if len(matches) > 1 {
			assignID := strings.TrimSpace(matches[1])
			if !activeAssignIDs[assignID] && len(assignments) > 0 { // safety check: only delete if assignments list is not empty (which could mean sync failed completely)
				log.Printf("[welearn-mirror] Menghapus tugas cerminan lama: %s (ID: %s)", t.Title, t.ID)
				db.Delete(&t)
			}
		}
	}

	return nil
}

// Helper: resolveCompletionStatus
func resolveCompletionStatus(mod moodleModuleItem) string {
	if mod.CompletionData == nil {
		return "new"
	}
	switch mod.CompletionData.State {
	case 1, 2:
		return "submitted"
	case 3:
		return "draft"
	default:
		return "new"
	}
}

// Helper: extractDueDateFromModule
func extractDueDateFromModule(mod moodleModuleItem) time.Time {
	for _, d := range mod.Dates {
		label := strings.ToLower(d.Label)
		if strings.Contains(label, "due") ||
			strings.Contains(label, "deadline") ||
			strings.Contains(label, "batas") ||
			strings.Contains(label, "closes") {
			if d.Timestamp > 0 {
				return time.Unix(d.Timestamp, 0).UTC()
			}
		}
	}
	return time.Time{}
}

// Helper: isSessionExpiredError
func isSessionExpiredError(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "AJAX_SESSION_EXPIRED") || strings.Contains(s, "SESSION_EXPIRED")
}

// Helper: requiresSubmission
func requiresSubmission(name string, eventType string) bool {
	if eventType != "assign" && eventType != "quiz" {
		return false
	}
	nameLower := strings.ToLower(name)
	if strings.Contains(nameLower, "pengantar") ||
		strings.Contains(nameLower, "welcome") ||
		strings.Contains(nameLower, "silabus") ||
		strings.Contains(nameLower, "kontrak") ||
		strings.Contains(nameLower, "materi") ||
		strings.Contains(nameLower, "modul") ||
		strings.Contains(nameLower, "slide") ||
		strings.Contains(nameLower, "hadir") ||
		strings.Contains(nameLower, "presensi") ||
		strings.Contains(nameLower, "kehadiran") ||
		strings.Contains(nameLower, "attendance") ||
		strings.Contains(nameLower, "meet") ||
		strings.Contains(nameLower, "zoom") ||
		strings.Contains(nameLower, "link") ||
		strings.Contains(nameLower, "ulangan") ||
		strings.Contains(nameLower, "uts") ||
		strings.Contains(nameLower, "uas") ||
		strings.Contains(nameLower, "ujian") ||
		strings.Contains(nameLower, "pengumuman") ||
		strings.Contains(nameLower, "announcement") {
		return false
	}
	return true
}
