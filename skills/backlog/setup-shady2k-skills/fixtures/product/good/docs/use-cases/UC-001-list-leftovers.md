# UC-001 — List tonight's leftovers

Serves: US-001
Level: user goal
Primary actor: cafe owner
Scope: the leftovers app
Scenario: list-leftovers
Trigger: the cafe is about to close

## Preconditions
The owner is signed in as their cafe.

## Success end condition
The portions are listed with their price, and people nearby can see them until the cafe closes.

## Failed end condition
Nothing is listed, and the owner is told why.

## Main success scenario
1. The owner opens the listing for tonight.
2. The owner picks the dishes that are left and how many portions of each.
3. The owner sets the price, half of the menu price by default.
4. The owner confirms, and the listing is shown to people nearby.

## Extensions
- 2a the dish is not on the menu: the owner types its name.
- 4a there is no connection: the listing is kept and sent when there is one.

## Open issues
- Q-001

## Sources
- S-001 L12 "it has to take a minute"
