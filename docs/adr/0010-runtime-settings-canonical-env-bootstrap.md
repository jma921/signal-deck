# Runtime Settings Canonical With Env Bootstrap

SignalDeck will treat local SQLite runtime settings and secrets as canonical after startup. Environment variables are first-run and deployment bootstrap inputs only; they seed missing settings/secrets but do not overwrite operator changes already stored in the runtime database.

This keeps self-hosted startup simple while allowing the one-operator station to adjust configuration locally without editing `.env` and restarting the app.
