# SignalDeck

SignalDeck is a live production dashboard for monitoring and coordinating a church service broadcast.

## Language

**Service**:
A scheduled worship gathering or broadcast session. In this context, this is not a software service.
_Avoid_: Event, meeting, stream

**Service Order**:
The ordered list of segments that make up a **Service**. Each **Service Order** contains many **Service Items** and is owned by **PCO Services**.
_Avoid_: Agenda, run sheet, queue

**PCO Services**:
The planning system that owns the **Service Order** for a **Service**.
_Avoid_: Planning Center, PCO, schedule source

**Service Item**:
One segment within a **Service Order**, such as a song, prayer, scripture reading, sermon, or media loop.
_Avoid_: Task, block, row

**Service Position**:
The live execution pointer within a **Service Order**, controlled by the SignalDeck operator during a **Service**.
_Avoid_: Active item, cursor, progress

**Presentation**:
A lyric or media presentation used during a **Service Item**. Presentation state is owned by **ProPresenter**.
_Avoid_: Deck, slideshow

**ProPresenter**:
The presentation system that owns the **Current Slide** and **Next Slide** shown by SignalDeck.
_Avoid_: Slide source, presentation engine

**Slide**:
One displayable unit within a **Presentation**. A **Slide** may contain lyric lines or be blank for instrumental moments.
_Avoid_: Screen, frame, page

**Current Slide**:
The **Slide** currently intended for the stage or broadcast output.
_Avoid_: Active screen, live page

**Next Slide**:
The **Slide** queued after the **Current Slide**.
_Avoid_: Preview, upcoming screen

**Stream Health**:
The overall broadcast quality state reported by the **Encoder**, inferred from bitrate, dropped frames, encoder load, and uptime.
_Avoid_: Status, signal quality

**Encoder**:
The production system that produces the live broadcast stream and owns producer-side health metrics.
OBS is SignalDeck's first concrete **Encoder** implementation.
_Avoid_: Stream source, broadcast app

**Connection**:
An external production system or platform that SignalDeck monitors, such as ProPresenter, PCO Services, YouTube Live, Facebook Live, or audio hardware.
_Avoid_: Integration, source, endpoint

**Viewer**:
A person watching the live broadcast on a streaming platform.
_Avoid_: User, attendee, audience member

**Chat Message**:
A message from a **Viewer** on a streaming platform during a **Service**.
_Avoid_: Comment, post

**Playlist**:
A compact visual progression of the **Service Order**.
_Avoid_: Queue, timeline

## Example Dialogue

"Where are we in the Service Order?"

"The Service Position is Mercy Like A River, and the Current Slide is Chorus."

"Who decides which Slide is current?"

"ProPresenter owns Current Slide and Next Slide; SignalDeck mirrors them."

"Where did that Service Order come from?"

"PCO Services owns it; SignalDeck is showing its current production state."

"What should I prepare next?"

"The Next Slide is Chorus 2, and the next Service Item is Great Is The Lord."

"Is the broadcast healthy?"

"Stream Health is degraded because dropped frames are rising; YouTube Live is also showing a warning Connection."

"Which system owns that health reading?"

"The Encoder owns Stream Health; YouTube Live and Facebook Live are platform Connections."
