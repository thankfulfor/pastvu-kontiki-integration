# Research Notes

## PastVu

Known endpoint:

```text
GET https://api.pastvu.com/api2?method=photo.giveForPage&params={"cid":2479426}
```

Known useful fields:

- `result.photo.cid`
- `result.photo.file`
- `result.photo.title`
- `result.photo.y`
- `result.photo.year`
- `result.photo.year2`
- `result.photo.geo`
- `result.photo.regions`

Known error behavior:

- API errors are returned as JSON.
- HTTP status can still be `200 OK`.
- Integration code should check the top-level `code` field.

## Kontiki Maps

To research:

- public API or SDK;
- custom marker support;
- data import formats;
- iframe/embed options;
- licensing or usage restrictions.

## Prototype Options

Option 1: Static frontend with map markers.

Option 2: Static frontend plus local JSON fixture.

Option 3: Frontend with a small backend proxy if CORS or request limits block direct API calls.

## Open Decisions

- Which map technology to use if Kontiki Maps does not expose a public SDK.
- Which PastVu API method to use for discovering photos near a location.
- Whether the first prototype should use live API calls or a curated fixture.
