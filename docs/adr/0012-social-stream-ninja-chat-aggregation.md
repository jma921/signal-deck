# ADR-0012: Social Stream Ninja as Chat Aggregation Middleware

## Status

Accepted

## Context

SignalDeck needs to display a unified chat feed from YouTube Live and Facebook Live in a single panel. Currently the chat monitor tab-switches between two browser tabs during a service. The `ProductionSnapshot` contract already has `chatMessages: ChatMessage[]` with a `platform` field — the data shape is ready; only the integration is missing.

Two approaches were considered:

**Option A: Direct platform APIs.** YouTube's Live Streaming API and Facebook's Graph API for live video both support reading live chat. However, both require app registration, OAuth token refresh, and are subject to review processes and rate limits. Facebook's live video API in particular has a history of breaking changes and restricted access. Building two separate integrations would take significantly longer and introduce two distinct credential management surfaces.

**Option B: Social Stream Ninja.** An open-source chat relay tool (GPLv3) that captures chat from open browser tabs via a Chrome/Firefox extension and relays messages through a hosted WebSocket server at `io.socialstream.ninja`. A single WebSocket connection receives normalized messages from all connected platforms. The same connection supports a `sendChat` action for future Reply and Broadcast features.

## Decision

Use Social Stream Ninja as the chat aggregation middleware. SignalDeck connects to the Social Stream Ninja relay WebSocket using a session ID stored as a server-side secret. The operator installs the extension on the broadcast machine and opens YouTube Studio and Facebook Live tabs during services — the same tabs the chat monitor already watches.

The integration is monitor-only for now. The `SocialStreamManager.sendChat()` method is stubbed to provide a clear seam for future Reply (send to originating platform) and Broadcast (send to all platforms) features without rearchitecting.

## Trade-offs

**What we give up:**
- No external browser extension dependency for direct API integrations.
- Social Stream Ninja is a third-party relay service — if `io.socialstream.ninja` is unavailable, chat monitoring is unavailable. Self-hosting the relay is possible (the project is open source) but adds operational overhead.
- The session ID grants access to the chat relay; it must be protected as a secret.

**What we gain:**
- Both YouTube and Facebook are supported immediately with one integration instead of two.
- No OAuth app registration, API review, or token refresh to manage.
- The extension handles platform authentication; SignalDeck only needs the session ID.
- Future Reply and Broadcast route through the same WebSocket with no new credentials.

## Consequences

- `IntegrationKey` now includes `"socialstream"`.
- Session ID is stored in the `SecretStore` under `("socialstream", "sessionId")`.
- The chat panel in simulation mode still shows seeded data; in live mode it shows the relay feed (empty if Social Stream is disconnected or disabled).
- `ChatPlatform` values `"YT"` and `"FB"` map from Social Stream Ninja's `type` field (`"youtube"` and `"facebook"`).
