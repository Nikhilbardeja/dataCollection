package cache

import (
	"context"
	"dataCollection/internal/config"
	"time"
)

func (imc *inMemoryCache) SetAdminSession(sessionID string, adminID int64, role string, expiresAt time.Time) {
	imc.mu.Lock()
	defer imc.mu.Unlock()
	imc.adminSessions[sessionID] = AdminSession{
		AdminID:   adminID,
		Role:      role,
		ExpiresAt: expiresAt,
	}
}

func (imc *inMemoryCache) getAdminSession(sessionID string) (AdminSession, bool) {
	imc.mu.RLock()
	defer imc.mu.RUnlock()

	sess, ok := imc.adminSessions[sessionID]
	if !ok {
		return AdminSession{}, false
	}
	if time.Now().After(sess.ExpiresAt) {
		return AdminSession{}, false
	}
	return sess, true
}

func (imc *inMemoryCache) DeleteAdminSession(sessionID string) {
	imc.mu.Lock()
	defer imc.mu.Unlock()
	delete(imc.adminSessions, sessionID)
}

func (imc *inMemoryCache) LoadAdminSessions() error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	rows, err := config.DB.Query(ctx, `
		SELECT s.sessionId, s.adminId, a.role, s.expires_at
		FROM admin_sessions s
		JOIN admins a ON a.adminId = s.adminId
		WHERE s.expires_at > NOW()
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	tmp := make(map[string]AdminSession)
	for rows.Next() {
		var sessionId string
		var sess AdminSession
		if err := rows.Scan(&sessionId, &sess.AdminID, &sess.Role, &sess.ExpiresAt); err != nil {
			return err
		}
		tmp[sessionId] = sess
	}

	imc.mu.Lock()
	defer imc.mu.Unlock()
	imc.adminSessions = tmp
	return nil
}

// LoadAdminSessionById returns the admin session for sessionId.
// It first checks the in-memory cache, and on a cache miss it loads
// the single session from the database and caches it for next time.
// Middleware should use this as a fallback when the session is not in cache.
func (imc *inMemoryCache) GetAdminSessionById(sessionID string) (AdminSession, bool) {
	// 1. firstly check in session
	if sess, ok := imc.getAdminSession(sessionID); ok {
		return sess, true
	}

	// 2. check db if does not exist in cache
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var sess AdminSession
	err := config.DB.QueryRow(ctx,
		`SELECT s.adminId, a.role, s.expires_at
		 FROM admin_sessions s
		 JOIN admins a ON a.adminId = s.adminId
		 WHERE s.sessionId = $1 AND s.expires_at > NOW()`,
		sessionID,
	).Scan(&sess.AdminID, &sess.Role, &sess.ExpiresAt)

	if err != nil {
		return AdminSession{}, false
	}

	// 3. load in cache
	imc.SetAdminSession(sessionID, sess.AdminID, sess.Role, sess.ExpiresAt)

	return sess, true
}

func (imc *inMemoryCache) CleanupExpiredAdminSessions() {
	imc.mu.Lock()
	defer imc.mu.Unlock()
	now := time.Now()
	for sid, sess := range imc.adminSessions {
		if now.After(sess.ExpiresAt) {
			delete(imc.adminSessions, sid)
		}
	}
}
