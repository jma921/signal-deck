# ProPresenter Owns Slide State

SignalDeck will mirror ProPresenter for Current Slide and Next Slide instead of controlling slides itself at first. ProPresenter is already the stage-output authority, and keeping SignalDeck read-only for slide state avoids competing control surfaces while the monitoring workflow is established.
