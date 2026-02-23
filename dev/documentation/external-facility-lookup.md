# External Facility Lookup

## Overview

The Add Venue drawer supports an optional **External Lookup** button that connects to
a third-party facility service. The button only renders when the active provider
advertises facility lookup capabilities.

## Provider Requirements

A provider must include both properties for the button to appear:

```json
{
  "facilityService": true,
  "facilityLookup": {
    "endpoint": "/facility/search",
    "method": "POST"
  }
}
```

- `facilityService: true` — signals the provider has a facility directory.
- `facilityLookup` — an object describing how to connect. Its shape is
  provider-defined; the minimum contract is that the object is truthy.

The check lives in `addVenue.ts → hasFacilityService()`:

```typescript
function hasFacilityService(): boolean {
  const provider = context.provider;
  return !!(provider?.facilityService && provider?.facilityLookup);
}
```

## UI Placement

The button spans the full width of the drawer and sits directly above the
Venue Name field. It is rendered before `renderForm` populates the remaining
form inputs.

## Intended Integration Flow

Two integration models are anticipated:

### Option A — Provider-hosted modal

The provider supplies a URL (e.g. `facilityLookup.widgetUrl`) that is loaded
inside an iframe or opened as a popup. The external widget handles its own
search UI and returns structured venue data via `postMessage` or a redirect
callback.

Pros: zero TMX UI work per provider, full branding control for the provider.
Cons: requires the provider to build and host a widget.

### Option B — TMX-native search modal

TMX builds a modal with search fields:

| Field          | Type   | Notes                        |
|----------------|--------|------------------------------|
| Facility name  | text   | Free-text search             |
| Country        | select | ISO country codes            |
| State/Province | text   | Optional, depends on country |
| City           | text   | Optional                     |

TMX calls the provider's `facilityLookup.endpoint` with the search params.
The response returns a list of matching facilities. The user selects one and
the modal auto-fills the venue form fields (name, abbreviation, address,
courts count, opening/closing times, GPS coordinates, etc.).

Pros: consistent UX across providers, TMX controls the experience.
Cons: each provider must conform to a request/response contract.

### Recommended Approach

Start with **Option B** since TMX already owns the drawer and form state.
Define a simple search/response contract in the provider API docs and iterate.
Option A can be offered later as an escape hatch for providers with bespoke
requirements.

## Data Contract (draft)

### Search request

```
POST {facilityLookup.endpoint}
{
  "name": "Springfield Tennis Center",
  "country": "USA",
  "state": "IL",
  "city": "Springfield"
}
```

### Search response

```json
{
  "facilities": [
    {
      "facilityId": "ext-12345",
      "facilityName": "Springfield Tennis Center",
      "abbreviation": "STC",
      "address": {
        "city": "Springfield",
        "state": "IL",
        "country": "USA",
        "postalCode": "62701",
        "latitude": 39.7817,
        "longitude": -89.6501
      },
      "courtsCount": 12,
      "defaultStartTime": "07:00",
      "defaultEndTime": "21:00",
      "surfaces": ["HARD", "CLAY"]
    }
  ]
}
```

## Related Files

| File | Role |
|------|------|
| `src/pages/tournament/tabs/venuesTab/addVenue.ts` | Drawer with lookup button |
| `src/components/forms/venue.ts` | Venue form config & value extraction |
| `src/services/context.ts` | `context.provider` holds active provider |
| `src/services/apis/servicesApi.ts` | Provider API helpers |
| `src/i18n/locales/en.json` | `pages.venues.addVenue.externalLookup` key |
