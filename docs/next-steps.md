# Next Steps

## First Slice

Done: extract a shared app-state provider contract, move the current seeded/live-jitter behavior into a simulation provider, and keep the existing dashboard rendering from that provider-backed state.

The provider contract should expose one coarse Production Snapshot containing Service Order, Service Position, slide state, Stream Health, Connections, and Chat Messages.

Done: add minimal manual Service Position controls by clicking Service Items in the Service Order. Manual changes disable simulation service auto-advance for the session.

## Then

Done: add a local SQLite runtime foundation with startup migrations, typed core integration settings, plaintext scoped secrets, and local-only settings/secrets API routes.

Done: add a server-side OBS integration manager with persistent connection lifecycle, sanitized status, test, and reconnect routes. OBS status is not wired into the dashboard yet.

## Then Next

Add a PCO Services provider for the planned Service Order while keeping SignalDeck-owned Service Position local to the app.

Assume one operator station for the first live version. Do not add auth, persistence, or realtime multi-client synchronization until the one-station workflow is useful.

PCO Services credentials should be read by the Bun server from environment variables. The browser should call local SignalDeck endpoints rather than calling PCO Services directly.

PCO Service Order data should load on startup, support manual refresh, and refresh in the background about every 60 seconds.

If PCO Services is unavailable, keep the last successful Service Order visible, mark it stale, and preserve the local Service Position. Do not automatically replace live data with simulation data.

## Not First

- Do not make SignalDeck control ProPresenter slides yet; mirror Current Slide and Next Slide first.
- Do not add chat replies, pins, or moderation before monitor-only chat works.
- Do not collapse simulation into a separate demo path; it should use the same provider contract as live data.
- Do not split into per-panel subscriptions before a single Production Snapshot becomes too expensive or awkward.
- Do not build multi-client Service Position synchronization before the one-operator live workflow is proven.
- Do not expose PCO Services credentials in browser code or browser storage.
- Do not silently show simulated Service Order data when the live PCO provider fails.
