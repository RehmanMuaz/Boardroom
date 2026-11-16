# UI audit and polish

Scope: Boardroom entry/authentication, workspace picker/rename, header and command search, account/team/client-link dialogs, export/PDF/frames, workspace styles, modifiers/quick actions, annotations and media inspection. Preserve the overall layout, original creation rail order and existing document data. Work is local on fix/ui-polish; nothing deployed.

| Confirmed finding | Correction |
| --- | --- |
| Workspace caret is a tiny font glyph with uneven baseline/spacing | Fixed-size SVG chevron, centered flex row, explicit gap, safe name truncation and expanded-state rotation |
| Product mark is a generic text glyph; no browser/bookmark icon | Original Boardroom product tile in entry/header, SVG/PNG favicon and Apple bookmark metadata |
| Mixed font-symbol metrics in creation/history and header controls | Shared SVG grid/stroke sizes; existing labels, tool order and sidebar widths retained |
| 320px PDF dialog clips fields/text despite no page-level overflow | Allow nested grid children to shrink, bound dialog/body widths and keep preview scrolling inside its own container |
| Broad dialog input rules stretch checkbox/range controls | Scoped text-field geometry, 16px checkbox/radio controls and native range sizing |
| Team inputs have extra native margins; long emails crowd member controls | Consistent field height/margins and wrapped member rows |
| Primary actions look like ordinary navigation/cancel buttons | Explicit accent classes for commit/proceed actions, accessible foreground in light/dark themes; no blanket coloring of every button |
| Remove/revoke/discard actions lack visual distinction | Restrained semantic danger treatment while neutral navigation remains neutral |
| Modifier panel covers the left edge of the desktop board title | Adjust heading padding only; canvas origin, positions and editing coordinates remain unchanged |
| Short windows clip creation tools behind history controls | Scroll the existing tool region and keep history accessible in its original position |
| Long dialog/media titles and large workspace lists risk overflow | Shrinkable/wrapping title groups and bounded scrollable workspace menus |
| Hub's legacy company-logo filter turns colored product tiles into silhouettes | Scope the product tile to retain its color; company logos remain unchanged |
| Studio's old letter-logo rotation misaligns a geometric app tile | Square, unrotated app-mark container, retaining wordmark and existing layout |

The shared family includes Hub, Flow, Boardroom, Canvas and Studio. Boardroom carries the whole SVG catalog and preview at /brand/preview.html; Hub uses recognized installed-app metadata without adding applications or granting access. Studio has its matching header/tab/bookmark icon. Flow's matching source asset is provided without modifying its MCP contracts or unrelated in-progress work. No separate Canvas app exists in this workspace; its icon is prepared without renaming Studio.

Validation covers layout at desktop/laptop/tablet/phone widths, long names, owner/viewer controls, light/dark contrast, native dialog focus, child overflow (not merely document scrollWidth), top-bar overlap, short-rail access and stable existing creation placement. Existing regressions also exercise persistence, media, annotations, comments, sharing, PDF and styles. Studio's identity was visually checked at 1440/390 px with a synthetic session response; its API suite uses a disposable database on the working local PostgreSQL instance because Windows currently reserves the usual Studio port. Hub identity/access checks run offline, without contacting Frappe production or providers.

This is UI polish. Mobile touch navigation/pinch zoom, native apps, offline editing and new feature development remain separate backlog work. No schema/document migration, provider action or deployment is part of these fixes.

Final local checks: Boardroom 92 core/backend/PDF passes plus 54 browser passes and production build; one existing Windows platform skip. Studio production build plus five API/domain passes and visual identity checks. Hub two offline identity/access checks, four domain checks and source syntax checks. Private frontend/readiness/icon-gallery checks return 200.

Modifier-label follow-up: inherited h3 bottom margins and generic property-button borders still affected collapsible headings. Scoped grid/reset rules now align labels and fixed-size SVG plus/minus indicators without changing panel layout. The indicator also reflects search-forced expansion. Geometry checks cover open/collapsed/search states at desktop and phone widths; all eight focused browser regressions, 92 core checks (one existing skip) and production build pass.
