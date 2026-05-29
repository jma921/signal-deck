# SignalDeck

SignalDeck is a Bun + React live production dashboard for a church service control room. The current app is a simulated operator view: slides, service flow, stream health, platform connections, chat, and display tweaks are all driven from local React state and seed data.

## Run

```bash
bun install
bun dev
```

Build for production:

```bash
bun run build
bun start
```

## Current Shape

- `src/index.ts` serves the app with `Bun.serve()` and still includes template `/api/hello` routes.
- `src/frontend.tsx` mounts the React app from `src/index.html`.
- `src/App.tsx` renders the dashboard from the production provider snapshot.
- `src/data.ts` contains seeded service, slide, connection, chat, and stream health data.
- `src/production/` contains the production snapshot contract and simulation provider.
- `src/components/` contains presentational panels for the dashboard.
- `src/index.css` owns the visual system and responsive layout.

## Development Notes

- Use Bun commands in this repo: `bun dev`, `bun test`, `bun run build`.
- Treat `CONTEXT.md` as the domain glossary only. Do not put implementation decisions there.
- The app currently has no persisted data, backend integration, auth, or real platform APIs.
- The next major direction is live integration with production systems while retaining simulation as a fallback/demo mode.

## Decided Boundaries

- PCO Services owns the planned Service Order.
- SignalDeck owns the live Service Position within that order.
- ProPresenter owns Current Slide and Next Slide; SignalDeck mirrors slide state first.
- The Encoder owns Stream Health; destination platforms are monitored as Connections.
- Chat integration should be monitor-only before adding replies, pins, or moderation actions.
- Simulation and live integrations should feed the same app-state provider contract.
- The first live version assumes one operator station, not synchronized multi-client control.
- PCO Services credentials stay server-side; browser code should call SignalDeck endpoints, not PCO directly.

See `docs/next-steps.md` for the current implementation path.
