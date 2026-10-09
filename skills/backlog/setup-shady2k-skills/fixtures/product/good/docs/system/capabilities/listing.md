# Listing

Capability: listing

## Purpose
Keeps a cafe's listing of tonight's leftovers.

## Requirement: listing-expiry — A listing expires at closing
Serves FR-002. When the cafe's closing time for the day passes, the listing service shall stop returning that cafe's listing.

### Scenario: expired-listing
- Given: a listing of a cafe that closes at 18:00
- When: a buyer asks for listings at 18:01
- Then: the listing is not returned
