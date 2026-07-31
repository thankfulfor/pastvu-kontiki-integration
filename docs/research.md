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

Dataset page:

```text
https://kontikimaps.ru/how-old/cities250/datasets?p=cities250
```

Known dataset facts:

- the dataset is distributed as GeoPackage (`.gpkg`);
- the page states that the dataset is available under the Open Data Commons Open Database License (ODbL);
- the dataset includes 80 Russian cities;
- the first prototype can use Moscow only to reduce scope.

License note:

- Keep the repository license for project code separate from external data licensing.
- If the project includes Kontiki-derived data, document attribution and ODbL share-alike requirements in a dedicated data license section.
- Avoid calling the license "viral" in repository docs; use "share-alike" or "ODbL" instead.

## Prototype Options

Option 1: Static frontend with map markers.

Option 2: Static frontend plus local JSON fixture.

Option 3: Frontend with a small backend proxy if CORS or request limits block direct API calls.

## Open Decisions

- Which map technology to use if Kontiki Maps does not expose a public SDK.
- Which PastVu API method to use for discovering photos near a location.
- Whether the first prototype should use live API calls or a curated fixture.
- Whether the repository will store Kontiki-derived data or only scripts/instructions for obtaining it.
