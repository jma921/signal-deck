# Server-Side PCO Credentials

SignalDeck will keep PCO Services credentials on the Bun server and expose local SignalDeck endpoints to the browser. This avoids leaking planning-system credentials into client code while keeping the first one-operator integration simpler than a full OAuth login flow.
