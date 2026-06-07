# ProPresenter Slide State Is Text-Only

Refines ADR-0004. SignalDeck mirrors ProPresenter slide state as **current slide text + next slide text + a live indicator** — not as a full slide array with indices and position counters.

The dashboard's Current Slide / Next Slide panels exist to answer "what's on screen now, and what's next." ProPresenter's `GET /v1/status/slide?chunked=true` stream gives exactly those two rendered strings without us fetching and correlating the active presentation's whole arrangement. Reading only the text keeps the integration small and removes a class of drift bugs (our cached slide array disagreeing with what ProPresenter actually rendered). The cost is that we drop the `N / total` position counters that the simulation UI used to show; faking those against a two-string feed would be worse than not showing them on a live broadcast surface.

The `live` ("ON STAGE" vs "BLANK") indicator is driven by a **second** chunked stream, `GET /v1/status/layers?chunked=true`, reading whether the slide layer is active. It is deliberately **not** inferred from whether the slide text is non-empty: when an operator clears the screen, ProPresenter keeps reporting the last slide's text, so text-inference would leave the panel claiming "ON STAGE" while nothing is shown — the exact failure a production monitor must avoid.

This reshapes the shared `SlideState` in the `ProductionSnapshot` contract (ADR-0006/0007), so both the live and simulation providers now emit the text-only shape.

## Amendment: section labels via the active presentation

`SlideState` also carries `currentLabel` / `nextLabel` — the slide's group/section name ("Verse 1", "Chorus"). These come from a narrow `GET /v1/presentation/active` fetch (song name + ordered groups, each with slide text), **not** the slide-status stream, which has no label. We still don't ingest a full slide array or position counters.

The join key is the slide **text**, not a uuid: the active-presentation payload exposes a uuid only per *group*, never per *slide*, while `/v1/status/slide` gives a *slide* uuid — the two don't correspond. So we index `slideText → groupName` and label the live current/next text by exact text match. The active presentation is fetched on connect and re-fetched lazily when an incoming slide isn't in the current map (i.e., the song changed). Duplicate slide text resolves to its first occurrence — acceptable for a label.
