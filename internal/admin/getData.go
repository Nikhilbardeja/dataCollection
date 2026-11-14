package admin

import (
	"context"
	"dataCollection/internal/config"
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
)

func getDataByDate(c *gin.Context) {
	date := c.Query("date") // Example: ?date=2026-11-13
	if date == "" {
		c.JSON(400, gin.H{"error": "The date query parameter is required, e.g. ?date=2026-11-13"})
		return
	}

	// Validate the date format.
	if _, err := time.Parse("2006-01-02", date); err != nil {
		c.JSON(400, gin.H{"error": "Invalid date format; use YYYY-MM-DD"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	var result json.RawMessage
	err := config.DB.QueryRow(ctx, `
		SELECT json_build_object(
			'date', $1::text,
			'submissions', COALESCE((
				SELECT json_agg(
					json_build_object(
						'submissionId', s.submissionId,
						'phone', s.phone,
						'created_at', s.created_at,
						'documents', COALESCE((
							SELECT json_agg(
								json_build_object(
									'document_id', d.document_id,
									'fields', d.fields
								)
							)
							FROM (
								SELECT document_id,
									   json_object_agg(field_key, field_value) AS fields
								FROM submission_values
								WHERE submissionId = s.submissionId
								GROUP BY document_id
							) d
						), '[]'::json)
					)
					ORDER BY s.submissionId
				)
				FROM submissions s
				WHERE DATE(s.created_at) = $1::date
			), '[]'::json)
		)
	`, date).Scan(&result)

	if err != nil {
		c.JSON(500, gin.H{"error": "db error: " + err.Error()})
		return
	}

	c.Data(200, "application/json", result)
}
