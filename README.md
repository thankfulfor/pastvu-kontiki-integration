# PastVu Kontiki Integration

Small prototype and research notes for integrating PastVu photo data into a Kontiki Maps scenario.

## Goal

Build a minimal working integration that shows how historical photo data from PastVu can be used in a map-based interface, then document the integration process as a technical writing portfolio case.

## User Scenario

A map user opens a location, sees historical photos connected to this place, and can inspect a photo card with:

- title;
- image;
- year or date range;
- location;
- link to the original PastVu page.

## Research Questions

- What PastVu API methods provide photo data by id, coordinates, or region?
- Which fields are stable enough for a public integration example?
- Does Kontiki Maps provide an API, SDK, embed mechanism, or data import format?
- Can the prototype run as a static frontend, or does it need a small backend proxy?
- What limitations should be documented for external developers?

## Expected Outputs

- a small working prototype;
- integration notes;
- README for developers;
- portfolio article describing the research, implementation decisions, and documentation work.

## Current Status

Project initialized. The first step is to research Kontiki Maps integration options and choose the smallest viable prototype.
