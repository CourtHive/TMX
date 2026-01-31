# TODO

---

1. Event Entries needs to have a Ranking Column that is (potentially) editable.
2. For Flight generation to work, the scaleItems need to have the itemType: 'SCALE.RANKING.SINGLES.eventId'
3. There is an outstanding question about whether ranking org can be included, e.g. if considering ITF vs. ATP vs. USTA category rankings...
4. When rankings are pulled in from an external source it must always be in the context of the event, if the eventId is to be one of the '.' keys
5. It could be that 'SCALE.RANKING.SINGLES.ATP' is sufficient and client side logic can work out that ATP applies to MALE gender events?
6. if the event dialog attempts to change category: 1) if draws have been generated, disable the category selector 2) warning popover if a category is selected that would force event entries to be removed from the event due to not matching the category; 3) logic to remove entries that do not meet the category
