package cache

import (
	"context"
	"log"
	"time"
)

// StartRefreshScheduler runs until ctx is cancelled.
func StartRefreshScheduler(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Cache refresh scheduler stopped")
			return

		case <-ticker.C:
			if err := GetIMCache().Refresh(); err != nil {
				log.Printf("Scheduled cache refresh failed: %v", err)
				continue
			}

			log.Println("Scheduled cache refresh completed")
		}
	}
}
