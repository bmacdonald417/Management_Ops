# Emergency: Skip Migrations (SAFE_MODE)

If production crashes during migration (e.g. "column 'type' does not exist"):

1. **Railway:** Add env var `SAFE_MODE=true` in your project settings.
2. **Local:** `SAFE_MODE=1 npm start` (or add to `.env`).

The app will start without running migrations. Fix the migration, then remove SAFE_MODE and redeploy.
