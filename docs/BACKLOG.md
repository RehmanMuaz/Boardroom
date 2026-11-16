# Boardroom ideas and improvements

Use this file for features, UI changes, bugs and anything you want to improve. Plain bullet points are enough; the detailed template below is optional.

These are proposed ideas. [README](../README.md) describes implemented behavior, and [ROADMAP](ROADMAP.md) tracks milestones and remaining work.

## Requests

Current priority: shared workspace styles (IDEA-035), semantic roles (IDEA-037) and impact preview (IDEA-041) are implemented for review on feature/workspace-styles. The vector PDF upgrade passed CI and merged into develop; production retains the previous release. Format painter, expanded mixed-property editing and named export frames remain next. Preserve legacy workspace appearance and the main creation sidebar layout.

### IDEA-043: Vector PDF export

- Priority: Now - first
- Status: Implemented; PR #14 merged into develop after CI passed; not deployed
- What I want: Replace low-resolution page screenshots with PDF text and vector elements.
- Result: Selectable/searchable text with embedded self-hosted fonts; vector shapes, strokes, borders, labels, checklists and connectors; original PNG/JPEG image bytes/dimensions; same export settings, page clipping and authorization checks. Unsupported glyphs fail clearly. Font substitutions can change wrapping slightly; complex scripts and tagged accessibility remain limitations.
- Validation: PDF resource/text extraction, visible CJK rendering, original JPEG bytes, browser downloads, private-media/revocation and mobile regression checks. No existing workspace data changes.

### IDEA-042: Clean modifier panel with progressive disclosure

- Priority: Now - first
- Status: In progress; navigation/search/groups and inherited/custom indicators implemented locally; mixed-property controls for current multi-card selection are implemented in IDEA-038
- What I want: Preserve all features while making controls easy to find. Keep the main creation sidebar unchanged.
- Expected behavior: Selection header with object actions, stable Style/Arrange tabs, context-specific essentials, expandable detailed groups with clear current values, property search, persistent per-object preferences, mixed/inherited/custom indicators, and accessible Undo/Redo.
- Done when: Features remain available without a long always-visible panel; search finds hidden properties, keyboard/mobile access works, and the main creation rail remains unchanged.

### IDEA-033: Expand header options into organized dialog windows

- Type: Improvement / UI
- Priority: Now - first
- Status: Implemented locally; dialog layout refinement added (sections, labeled forms, fixed headers, inline help); not deployed
- What I want: Manage team, Actions and Account should open small in-app windows with room for in-depth options instead of cramped dropdowns. The structure should accommodate future settings without becoming confusing.
- Expected behavior: Keep the existing header entry points and open a clearly titled dialog with organized sections or tabs. Manage team groups members, invitations and client viewing links; Actions groups exports/imports and board operations; Account groups personal settings and session actions. Keep owner-only functions permission-gated.
- Interaction: One active dialog at a time, clear close/primary controls, sensible desktop sizing and a phone-friendly layout. Preserve keyboard navigation, focus containment/return, Escape behavior and accessible labels. Pending form changes must not disappear silently when closing or switching sections.
- Constraints: Preserve the existing editor, public client viewing boundaries, current account/team functionality and native file/color pickers. This changes header options only; the main creation sidebar layout, icons and order stay unchanged.
- Done when: The three header options use consistent, accessible dialogs with clearly grouped controls and space to expand, without losing existing actions or permissions.

### IDEA-034: Export boards to PDF

- Type: Feature / Export
- Priority: Now - second
- Status: Implemented locally; not deployed
- What I want: Export to PDF as an option in Actions, suitable for sharing and reviewing boards outside Boardroom.
- Expected behavior: Open an export dialog with a preview, explicit scope and page layout/scale settings. Start with the current board; choose sensible handling for large canvases so text remains readable and objects are not unexpectedly cropped. Include supported notes, annotations, shapes, connectors and images; represent video/files with understandable posters or labels/links. Define nested-board export separately rather than silently including all boards.
- Constraints: Export only content/media the current account or active viewer link can read. Keep private resources authorized during rendering; reflect supported workspace/board styles. Preserve the existing JSON backup/export action. An exported PDF is a static copy; expired/revoked access cannot recall a downloaded file.
- Done when: A PDF downloads with predictable scope, legible supported content, correct colors/layout and no editor controls, with useful progress/error feedback and tests covering private media and large-board behavior.
- Related: Prioritizes the PDF portion of IDEA-014; PNG, text, media ZIP and presentation exports remain separate work.

- Result: Actions > Export format > PDF exports the current board as an image-based document, with A4/Letter, portrait/landscape, fit or tiled actual size, page-boundary preview, progress/errors and private image embedding. Rechecks access before and after rendering. Video/files and nested boards use labels. Limits: 50 pages, 3,000 objects, 100 MB image inputs; selectable/vector text and named export frames remain separate work. Existing JSON backups and workspaces are unchanged.

### IDEA-035: Shared workspace styles with inheritance, overrides and reset

- Type: Feature / Design consistency
- Priority: Now - third
- Status: Implemented locally on feature/workspace-styles; not deployed
- What I want: Set fonts, colors and board appearance once for the whole workspace so boards look thematically consistent, similar to Microsoft Word styles. Individual elements can be customized and reset back to the workspace style.
- Expected behavior: A workspace style editor defines named roles such as heading, body text and label, plus a palette and default board background/pattern. Define a clear hierarchy: workspace style, optional board override, then element override. Inherited values follow later workspace style changes; explicitly overridden properties stay unchanged. Show whether a value is inherited or overridden and provide both per-property reset and Reset to workspace style.
- Reset behavior: Clearing an override restores inheritance rather than copying today's default into the element. If a board override exists, property reset returns to the inherited board value; Reset to workspace style explicitly removes the applicable board/element overrides. Preview the effect and make reset scope clear.
- Permissions and persistence: Workspace owners manage the shared style; editors retain allowed board/element overrides. Persist and sync style changes, validate inputs, preserve permission/conflict boundaries and make changes undoable where supported. Personal Light/Dark/System appearance stays separate from shared content styling.
- Compatibility: Do not reformat existing workspaces or reflow old content automatically. Provide an opt-in adoption/migration with preview, preserving current explicit formatting as overrides. Define font availability/loading, text sizing/reflow, media handling and PDF fidelity before implementation. Main creation sidebar layout remains unchanged.
- Done when: New boards/elements can inherit workspace styles; edits to shared defaults update inherited content consistently; local overrides survive; reset restores the intended inheritance; and existing workspace appearance stays intact until explicitly adopted.
- Related: Builds on IDEA-003 board appearance and text styling; PDF export in IDEA-034 must use the resolved styles.

### IDEA-036: Format painter

- Type: Feature / Usability
- Priority: Soon; coordinate with IDEA-035
- Status: Implemented locally on feature/format-painter; not deployed
- What I want: Copy formatting from one element and apply it to compatible elements without copying content.
- Expected behavior: Explicit source/target mode, clear preview and Escape cancellation. Distinguish applying a named inherited style from copying explicit overrides. Preserve text, assets, position, permissions and undo.

- Implementation: Copy formatting in the modifier panel, select a compatible target, preview, then Apply. Fixed appearance and linked named roles are separate choices. Escape cancels; live target-format changes require Refresh preview. Background-only copying preserves legacy typography; drawings copy stroke/fill without geometry. Single-step undo, existing permissions and document validation remain in use. Media, connectors and mixed selections are excluded. Per-word rich-text marks remain target-owned.

### IDEA-037: Named semantic style presets

- Type: Feature / Usability
- Priority: Soon; part of IDEA-035's style design
- Status: Implemented locally on feature/workspace-styles; not deployed
- What I want: Discoverable presets such as Heading, Body, Caption and Client feedback, with previews and clear current-style identification.
- Constraints: Reuse the shared style system rather than introducing a second formatting model. Preserve individual overrides and existing content unless explicitly changed.

### IDEA-038: Clear mixed values during multi-selection

- Type: Improvement / Usability
- Priority: Soon
- Status: Implemented locally on feature/mixed-selection-formatting; not deployed
- What I want: Clearly show Mixed when selected elements differ in font, size, color or other supported properties, while displaying shared values normally.
- Expected behavior: Editing one control changes only that property on compatible selected items. Do not silently reset unrelated formatting. Extend the existing mixed-background indicator consistently; respect permissions and undo.

- Implementation: Existing multi-card selection now aggregates effective fonts, size, weight, italic/underline, alignment, text/background colors and borders. Mixed values and mixed inheritance are distinct; resets remove only the selected property override. Typography/borders apply only to style-linked text-bearing cards, with explicit compatible counts; legacy backgrounds remain editable without enabling styles. Native indeterminate checkboxes and labeled sliders/numbers support keyboard/mobile use. Annotations retain their current single-selection workflow; adding cross-type annotation multi-selection is separate work.

### IDEA-039: Export regions and presentation frames

- Type: Feature / Usability
- Priority: Soon; coordinate with IDEA-034
- Status: Queued
- What I want: Define named regions or frames on a large board for predictable PDF pages and presentations.
- Expected behavior: Visible export boundaries and a preview of page order, clipping and scaling, with selection of frames to export. Keep frame/export scope explicit and preserve free canvas organization and authorized-content boundaries.

### IDEA-040: Searchable command menu

- Type: Feature / Usability
- Priority: Soon
- Status: In progress; keyboard/search foundation implemented, future PDF/style commands await those features
- What I want: Search actions such as Export PDF, Reset style, Duplicate and Share, with optional keyboard access.
- Expected behavior: Context-aware results show useful labels, grouping and shortcuts. Permission-gated actions stay protected; unavailable actions explain why. This supplements discoverable UI controls and preserves the main creation rail.

### IDEA-041: Preview workspace-wide style changes

- Type: Improvement / Usability
- Priority: Soon; part of IDEA-035
- Status: Implemented locally on feature/workspace-styles; not deployed
- What I want: Preview affected boards/elements before applying shared style changes, including which local overrides will be preserved.
- Expected behavior: Clear scope/impact summary, Apply/Cancel, and opt-in adoption for legacy workspaces. Previews must not save or broadcast partial changes; final application respects authorization, conflicts and the supported undo strategy.

### IDEA-029: Fix note cursor jumping to the start while typing

- Type: Bug
- Priority: Now - first; blocks normal editing
- Status: Implemented; covered by compatibility and regression tests
- Reported behavior: Typing in a note repeatedly moves the text cursor back to the start.
- Expected behavior: Typing, inserting in the middle, selecting/replacing text and using formatting preserve the caret and selection. Autosave, modifier-sidebar updates and live acknowledgements must not reset the editor while the user types.
- Investigation: Reproduce with plain and formatted notes, then check focus changes, component remounts, controlled updates and rich-text DOM rendering. Do not assume the cause before reproducing it.
- Constraints: Preserve undo/redo, IME/composition, paste, existing formatting and explicit concurrent-edit conflicts. Do not suppress legitimate remote updates to hide the issue.
- Done when: Sustained typing and mid-text edits keep the caret stable through local saves and team acknowledgements; regression coverage includes the reproduced case and reload persistence.

- Result: Rich-note parsing preserves bullet and empty-block semantics; DOM updates preserve selection rather than resetting it. Plain/rich typing and a focused live snapshot-refresh regression are covered. Stored legacy note formats remain unchanged until edited. Existing same-field conflicts remain; no character-level CRDT is claimed.

### IDEA-030: Duplicate standalone text annotations

- Type: Usability / Improvement
- Priority: Now - second
- Status: Implemented; covered by compatibility and regression tests
- Reported behavior: Standalone Text has no Duplicate option, unlike other canvas items.
- Expected behavior: Selecting text exposes Duplicate in the modifier sidebar Actions section. The copy retains text, typography, dimensions, colors, background and borders, receives a new ID, appears slightly offset and becomes selected. Include existing duplication keyboard behavior where applicable.
- Constraints: Preserve permissions, undo/redo, persistence and live sharing. Keep the main creation sidebar layout unchanged. Coordinate later annotation clipboard/group duplication with IDEA-002 rather than requiring it for this fix.
- Done when: A styled text annotation can be duplicated, the copy edits independently, duplication can be undone/redone, and both copies persist after reload and appear for authorized teammates. Viewers cannot duplicate.

- Result: Actions includes Duplicate annotation for standalone text (also supported for other annotations); Ctrl/Cmd+D works when the annotation is selected outside text editing. Copies retain formatting, get a fresh ID and 20 px offset, appear above other items, and are independent, undoable and persistent.

### IDEA-031: Account-free client viewing through emailed viewer links

- Type: Feature / Sharing
- Priority: Now - third
- Status: Implemented; covered by compatibility and regression tests
- What I want: Clients receiving a viewer link by email can open the shared workspace without creating an account or signing in.
- Expected behavior: An owner can create and email a read-only viewing link for a specific workspace. The recipient can inspect shared boards and authorized media with no registration flow. Keep this distinct from browser-local guest mode, which does not grant access to team content.
- Access design: Explicit owner-controlled link creation, expiry and revocation. Define whether links are transferable bearer links or require an email verification step; an emailed link alone does not prove the recipient's identity. Record the sharing choice clearly before implementation.
- Constraints: Scope every document, nested-board and media request to the shared workspace and active link. No editing, uploads, invitations, member management or access to other workspaces. Preserve authenticated team permissions and original branding. Decide download availability explicitly. Do not expose existing workspaces automatically.
- Done when: An emailed viewer link opens its intended workspace without an account, permits only read access to that workspace's content, and rejects expired/revoked links and cross-workspace access. Current member-invitation behavior remains available.
- Related: IDEA-012 controlled sharing and board-specific access. This request prioritizes workspace viewing; board-only scope can follow.

- Result: Owners use Actions > Client viewing links to email or manually copy a read-only bearer link. Default expiry is 7 days (choices 1/7/14/30), with owner revocation. Anyone holding/forwarding the link can view and download the entire workspace; the UI and email explicitly state this. Tokens are stored only as hashes, exchanged from the URL fragment into a scoped HttpOnly session grant; workspace and referenced-media reads revalidate expiry/revocation. No edit, upload, membership, invitation or private WebSocket authority is granted. Shared views refresh every 5 seconds. Old account invitations remain available; no existing workspace is automatically shared. Migration 009 only creates a new table.

### IDEA-032: Optional snap-to-grid placement and movement

- Type: Feature / Canvas usability
- Priority: Now - fourth
- Status: Implemented; covered by compatibility and regression tests
- What I want: Snapping to a grid should be available as an option.
- Expected behavior: A discoverable Snap to grid toggle enables consistent grid-aligned creation placement and object movement; disabled preserves free positioning. Choose and document grid spacing in canvas units so behavior stays consistent through zoom and pan. Treat grid visibility and snapping as separate options: a visible grid must not silently enable snapping.
- Interaction design: Preserve relative positions when moving groups, provide an obvious preview of the final snapped position, and define a temporary bypass. Existing column layout/reordering takes precedence over free-canvas snapping. Define which annotation types participate before implementation; avoid snapping every freehand point.
- Constraints: Preserve deliberate sidebar placement from IDEA-026, bounds, undo/redo, persistence, collaboration and viewer restrictions. Specify whether the toggle is personal or shared and how that preference is saved. Keep the main creation sidebar layout unchanged.
- Done when: Enabled snapping produces predictable positions at different zoom/pan settings, can be switched off without moving existing content, and works with group movement and column drops without unexpected jumps.
- Related: IDEA-015 snapping/alignment polish; this request prioritizes the optional grid behavior.

- Result: Board appearance includes Snap to grid, off by default and personal to the workspace/device. New item placement and pointer movement use 20 px canvas units; Alt bypasses, group offsets are preserved and column layout takes precedence. Grid visibility remains independent. Freehand/annotation geometry and fine keyboard nudges remain unsnapped. The preference does not modify workspace snapshots or move existing items when toggled.

### IDEA-026: Drag new elements from the creation sidebar onto the canvas

- Type: Improvement / Interaction
- Priority: Now - first implementation priority
- Status: Done locally; awaiting user review
- What I want: Drag an element from the creation sidebar onto the workspace and release it exactly where it should appear. Clicking a creation button currently feels like placement at a random location and is not intuitive.
- Expected behavior: Show a clear placement preview while dragging, then create the element at the drop position with correct zoom/pan coordinates. Dropping outside the canvas or cancelling creates nothing. Replace arbitrary click placement with an explicit placement mode: click a tool, then click the canvas to place it. Preserve an accessible keyboard alternative.
- Constraints: Preserve the main creation sidebar layout, spacing, icons and tool order exactly as they are. Add drag/click placement behavior without redesigning that sidebar. Extend the existing editor and contextual sidebar from IDEA-025. Preserve selection, column placement, undo/redo, persistence, live permissions and viewer restrictions. For media/files, retain the existing upload/file selection flow and permission checks; define placement before inserting the resulting object. Do not confuse sidebar element dragging with dropping uploaded files.
- Done when: Supported creation tools can be dragged to a deliberate canvas position at different zoom/pan settings, cancellation is safe, and clicking a tool no longer inserts an object at an unexplained position.
- Result: Existing creation buttons now support pointer dragging with a canvas preview and exact zoom/scroll-aware drop positions. Clicking or tapping arms placement instead of creating at an arbitrary location; click/tap the canvas or press Enter to place in view. Escape, cancelled gestures and drops outside the canvas create nothing. Media tools choose position before opening the file picker and preserve that position during upload. New content dropped into a column uses existing column layout. Main creation sidebar layout, icons, spacing and order remain unchanged. Undo/reload/live sharing and viewer restrictions are validated. Available in the private local preview; not deployed.

### IDEA-027: Full color picker alongside preset swatches

- Type: Improvement / Formatting
- Priority: Now - second implementation priority
- Status: Done locally; awaiting user review
- What I want: Choose custom colors instead of being limited to four preset colors.
- Expected behavior: Keep quick preset swatches and add a labeled color picker with an editable hex value for relevant selected-object color controls. Make it clear whether a control changes text, background, outline, label or connector color. Show the current value; retain transparent/automatic options where supported.
- Constraints: Reuse existing color validation and persistence. Preserve selected-object styling, undo/redo, live saving and viewer restrictions; do not change an individual's app theme or introduce unsupported object styling.
- Done when: Users can select any supported custom color or enter its hex value, understand which property it affects, and see it persist after reload and for teammates.

- Result: Preset background swatches remain, with a labeled native picker and editable hex input for custom backgrounds. Annotation stroke/text/background/border/shape-fill colors, note labels and connectors also have picker/hex pairs. Three- and six-digit hex values normalize on Enter/blur; invalid values do not change saved colors. Mixed selected backgrounds are shown explicitly; Auto/transparent annotation choices remain. Dark custom card backgrounds use readable light text, while light preset appearance is retained. Controls are limited to properties the selected object supports. Undo, reload, live sharing, viewer restrictions, accessibility and mobile layout are validated. Main sidebar layout unchanged; not deployed.

### IDEA-028: Organize the contextual formatting sidebar

- Type: Improvement / UI
- Priority: Now - third implementation priority, coordinated with IDEA-027
- Status: Done locally; awaiting user review
- What I want: Better organization, layout and labels only in the modifier sidebar shown when an object is selected. The main creation sidebar layout is already good and must remain unchanged.
- Expected behavior: Group relevant controls into clear sections such as Typography, Appearance, Size and Actions. Use readable labels, consistent spacing/alignment, and visible current values. Keep sliders plus precise numeric inputs for font size and stroke width. Clearly separate text color, background, border and fill controls; show only controls relevant to the selected object.
- Constraints: Scope layout changes strictly to the selected-object modifier sidebar. Do not change the main creation sidebar layout, spacing, icons or tool order. Build on IDEA-025's contextual left sidebar and back-to-tools navigation. Preserve accessible keyboard/focus behavior, responsive layouts, permissions and existing formatting features. Do not move formatting back onto canvas objects.
- Done when: Selected-object controls are easy to scan, colors and typography are clearly labeled and grouped, and the layout remains usable on smaller screens.

- Result: Selected-object modifiers are divided into labeled Content/Tasks/Media, Labels, Size, Appearance, Placement, Layers and Actions sections as relevant. Text annotations expose Typography, Appearance, Border and Size separately; shapes expose Shape, Outline, Fill and Size; pen/highlighter show Stroke. Sliders retain exact numeric inputs, dimensions show pixel units, and labels/color controls stay consistent. Empty/unavailable sections are hidden, Undo/Redo remain accessible at the bottom, and annotation size fields preserve validated geometry. The main creation rail layout, icons and order remain unchanged. Existing editing, live/viewer, mobile and accessibility checks are retained. Available in the private local preview; not deployed.

### IDEA-025: Content-only objects and a contextual left sidebar

- Type: Improvement / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: A cleaner Milanote-inspired canvas. Remove top drag buttons from every item and allow dragging from the item surface. Keep content, images and labels on objects; place their formatting and usage tools together in the left sidebar.
- Expected behavior: Selecting an object temporarily replaces the creation rail with its relevant controls. A back arrow restores the main rail. Double-click content to edit it; text selection and native media controls remain usable while editing/viewing.
- Constraints: Preserve keyboard access, group dragging, column membership/reordering, resizing, undo/redo, persistence, live collaboration and viewer permissions. Keep all testing local; do not deploy.
- Done when: No object has a top drag button or inline formatting/action toolbar, surface dragging works, selected-object controls appear together on the left, and the back arrow restores creation tools.
- Result: Removed top drag handles and inline object toolbars. Drag directly from object content; double-click or use Edit content to edit text, with native checkboxes/playback preserved. A contextual left sidebar replaces creation tools and groups formatting, labels, checklist actions, media downloads/subtitles, dimensions, colors, duplication, column placement, layers and deletion. Back to tools restores the single-icon-wide creation rail. Annotation creation tools remain at the bottom center of the canvas; selected-object formatting stays on the left. Local build, core tests, browser interaction/live/viewer checks and accessibility/mobile checks validate the change; no deployment.

### IDEA-018: Editable checklist titles and inline editing

- Type: Improvement / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Checklist cards should have a user-editable title like other notes instead of a fixed Todo heading. Edit list items directly in the list; remove the plain-text editing area at the bottom.
- Expected behavior or example: Rename a checklist to Shot list or Deliverables, then click a list item to edit its text directly while keeping its checkbox usable.
- Constraints or things to preserve: Existing list text and completion states, keyboard access, undo/redo, live saving and permissions. Coordinate with IDEA-010; this UI change should not require assignments or reminders.
- Done when: Checklist titles can be renamed and persist, list text is editable inline, and no separate plain-text editor appears beneath the list.
- Result: Checklist cards use editable titles (Untitled list for new cards) and inline task text/checkboxes, with Enter to insert, multiline paste, add/remove controls and no raw-text footer editor. Legacy text and completion states remain compatible. Titles save and sync independently from list text; viewer restrictions and reload are covered.


### IDEA-019: URL icon for links

- Type: Improvement / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Replace the current link icon with a recognizable URL/web icon wherever it represents a link card or its creation tool.
- Constraints or things to preserve: Clear tooltips and accessible names; existing URL entry and opening behavior. Related link-preview work remains IDEA-011.
- Done when: Link creation and link cards consistently use the URL icon and remain easy to identify.
- Result: Link creation and link cards use a shared globe/URL icon with the existing accessible Link control and URL editing/opening behavior preserved.


### IDEA-020: Separate connector line tool with visible arrows

- Type: Feature / Improvement / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: A dedicated line tool, separate from shape annotations, connects two notes/items. The line aims along the axis between the items' centers and follows movement/resizing, but its start and arrow tip stop just outside their outer edges. Connectors render behind all cards, columns and annotations.
- Expected behavior or example: Connect two notes, move or resize either note, and the line keeps its center-based direction while updating both outer-edge attachment points. Other objects can cover the connector because it stays behind them.
- Constraints or things to preserve: Reuse existing item connectors where appropriate. Keep free-drawn annotation shapes distinct from attached connectors. Preserve zoom/pan alignment, undo/redo, persistence and permissions. Item layer ordering in IDEA-021 always leaves connectors behind every object. Overlapping endpoint items have no exposed segment, so their arrow is hidden until they separate.
- Done when: The dedicated tool creates arrows aligned between two item centers with their start/end just outside the item edges. Moving/resizing updates those edge attachments, and arrows remain behind all objects.
- Result: The separate Line tool in the creation rail connects the first and second selected items. Straight arrows follow the center-to-center axis and clip to a two-unit clearance outside each item rectangle. The arrow marker places its exact tip at the destination endpoint without protruding into the card. Connectors render behind every object; overlapping/touching endpoint rectangles suppress the arrow until there is an exposed segment. The existing Connect cards action remains available; drawing shapes stay separate.


### IDEA-021: Move objects in front of or behind others

- Type: Feature / Improvement
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Controls to bring an object forward, send it backward, bring it to the front or send it to the back.
- Constraints or things to preserve: Layer order persists, syncs and supports undo/redo. Define ordering for cards, columns and annotations consistently with IDEA-015. Connectors from IDEA-020 remain behind all objects regardless of their layer order.
- Done when: Users can change overlapping objects' front/back order predictably, and that order survives reload and appears consistently for teammates.
- Result: A compact row of four accessible icon buttons with tooltips offers Bring forward, Send backward, Bring to front and Send to back for selected cards or annotations. Shared, bounded layers preserve relative group order and keep columns behind their children; connectors remain behind all objects. Undo/redo, reload, operation validation and viewer restrictions are covered.


### IDEA-022: Drag-and-drop column layout, fitting and reordering

- Type: Improvement / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Drag items into columns and automatically scale them to fit the column width. Allow resizing items within the column and dragging them up or down to reorder them.
- Expected behavior or example: Drop a large image into a column; it scales proportionally to fit. Resize it within the available width, then drag it between two notes to change its position.
- Constraints or things to preserve: Keep media proportions and readable content, respect column bounds and preserve contained-item order. Dragging into/out of a column updates membership and the counts in IDEA-024. Preserve selection, editing, zoom/pan, undo/redo, persistence and team permissions. Related canvas organization work is IDEA-015.
- Done when: Columns accept dragged items, fit them automatically, permit resizing within their bounds and support vertical drag reordering with saved membership and order.
- Result: Pointer dragging accepts cards into/out of columns and between vertical insertion positions, with a highlighted drop target. Reflow aligns members, fits widths, preserves ordinary media proportions and grows the column. Member resizing stays within column width; column resizing, caption changes and deletion reflow affected members. Column movement carries its members. Gesture undo restores membership, order and geometry together. Existing maximum dimensions apply; extreme media proportions retain contain rendering within minimum frame sizes.


### IDEA-023: Small colorful labels on notes

- Type: Feature / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Notes support small colorful labels along the bottom, styled like compact GitHub Shields badges or Milanote labels.
- Expected behavior or example: Add labels such as Client review and Approved with distinct colors; edit or remove them directly from the note.
- Constraints or things to preserve: Keep labels compact and legible, with text as well as color. Label text/colors persist, sync, export/import and support undo/redo and permissions.
- Done when: Users can add, edit, color and remove multiple bottom-of-note labels, and labels survive reload and shared updates.
- Result: Notes show compact bottom labels with editable text and color. Add/edit/remove controls, readable badge contrast, label-aware board search, duplication, JSON backups, undo/redo, durable operations and read-only viewer rendering are implemented. Labels are bounded to 20 per note and 80 characters each.


### IDEA-024: Column content counts beneath the title

- Type: Feature / UI
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Each column shows a summary of its contained items beneath its title, for example 3 cards, 1 file, 1 board. Images and videos count as cards.
- Expected behavior or example: Notes, checklists, links, images and videos contribute to the card count; file items and board tiles have separate counts. Use singular/plural wording and omit zero-count categories; an empty column shows 0 cards.
- Constraints or things to preserve: Derive counts from current direct column membership rather than a separately editable value. Update when items are added, removed, moved between columns or changed by teammates, including undo/redo. Count a nested board tile as one board rather than counting its contents.
- Done when: Every column displays accurate counts beneath its title, including images/videos as cards, and the summary updates with local and shared membership changes.
- Result: Columns derive a live summary from direct membership beneath the title. Notes/checklists/links/images/videos count as cards; files and board tiles have separate counts. Zero categories are omitted, empty columns show 0 cards, and membership changes plus undo/redo update local and shared summaries.


### IDEA-001: Image/Video UI

- Type: Improvement / UI
- Priority: Now
- Status: Done
- What I want: Images and videos should appear directly on the canvas without permanent borders, shadows or a padded card background. Actions such as downloading should use small icon buttons underneath, without visible button borders or text labels. Media must remain easy to move and resize.
- Why it matters: A cleaner canvas and less visual clutter.
- Expected behavior or example: Media is the focus. Selecting it reveals an outline and resize handles; small action icons have tooltips and accessible names. Resizing preserves the media's proportions by default.
- Reference links or screenshot paths:
- Constraints or things to preserve: Private workspace access, video playback controls, captions, downloads, keyboard access, live saves and undo/redo.
- Done when: Images and videos have no permanent card chrome, icon actions work, and selection, movement and resizing remain clear and usable.
- Subtitle refinement: New image/video uploads have no subtitle by default. An accessible icon in the bottom-right hover overlay on editable media adds or hides the subtitle; visibility persists and syncs, and hiding preserves its text. Existing media captions remain visible for compatibility.
- Subtitle entry: Adding a subtitle immediately focuses the writing area, with a visible focus outline and an empty-field placeholder. Only the user activating the button receives focus; remote updates do not steal focus.
- Result: Images/videos use transparent, unpadded frames without permanent borders or shadows. Downloads and subtitle toggles use accessible icons over a bottom-right gradient, visible on hover or keyboard focus. Images/videos drag directly from their surface while native playback controls remain usable; selection outlines and resize handles are transient. Pointer/keyboard resizing follows source proportions within model limits. Captions, native playback, private downloads, undo/redo and live persistence remain. File cards retain their existing presentation. Chromium covers appearance, proportional resizing, undo and shared dimensions. Fullscreen inspection/editing remains IDEA-006.

### IDEA-002: Annotation/Drawing

- Type: Feature
- Priority: Soon
- Status: Done locally; awaiting release
- What I want: Users can annotate above the other canvas elements with drawing, standalone text and eventually shapes. Annotation tools belong in a separate floating toolbar, similar to the zoom bar, rather than the top bar or creation rail.
- Why it matters: Easier visual communication and organization without adding clutter to the main navigation.
- Expected behavior or example: A toolbar floats near the bottom center, clear of the zoom and selection controls. Select, Pen, Highlighter, Shapes and Text are the intended tools. The active tool is obvious; color/thickness or text formatting controls appear when relevant. Tooltips explain icons.
- Reference links or screenshot paths:
- Constraints or things to preserve: Clear Draw/Select modes; annotations must not interfere with dragging cards, editing notes, panning or playing videos. Annotation positions stay aligned through zoom/pan. Team annotations persist and sync, viewers cannot edit, and undo/redo works. Show tools as their behavior is implemented.
- Delivery stages: Pen/highlighter, styled standalone text, and basic shapes are implemented. Typography is detailed in IDEA-003; header/navigation cleanup is IDEA-005.
- Result: Separate floating toolbar with Select, Pen, Highlighter and Text. Strokes support color/thickness, movement and deletion. Text focuses immediately on placement and supports fonts, size, weight, italic, underline, alignment, automatic/explicit color, optional background and borders, movement and resizing. Undo/redo, reload, authorized live sharing and viewer restrictions are covered by tests. Implemented on the feature branch; not promoted to production.
- Shapes: The Shape tool offers Arrow, Line, Rectangle and Circle (ellipse when drawn with unequal dimensions). Drag to draw; select to move/resize, change color/thickness/type, or add fill to rectangles/circles. Arrow direction follows the drag. Shared persistence, validation, permission checks, undo and conflicts use the existing annotation operations. Rotation, individual endpoint handles, annotation group/clipboard support and manual touch/stylus acceptance remain future work.
- Done when: The separate floating toolbar supports the delivered tools; annotations survive reload, remain aligned at different zoom levels and appear for authorized teammates.

### IDEA-003: Board appearance and annotation text styling

- Type: Feature
- Priority: Soon
- Status: Done locally; awaiting release
- What I want: Users can change the board background color and optionally its texture. Standalone text annotations support different fonts, sizes, weights and colors, with alignment controls.
- Clarification: Notes already have basic text formatting. This request is specifically for styling annotation text; it does not require rebuilding note formatting.
- Expected behavior or example: Borderless text annotations can be moved, edited and resized. Selecting a text annotation exposes its typography controls through the annotation toolbar. Board appearance has its own controls.
- Reference links or screenshot paths:
- Constraints or things to preserve: Reuse the existing formatting foundation where useful. Shared board appearance and annotation styles persist with the board; an individual's app theme is separate. Changes respect permissions, live saving and undo/redo.
- Delivery stages: Annotation typography, optional text backgrounds and borders are implemented with IDEA-002. Shared board colors, Plain/Dots/Grid patterns and Heading/Label/Body presets are implemented with IDEA-003. Optional paper textures and additional presets can follow.
- Result: Board appearance controls change the current board's shared canvas color and pattern. Use theme background restores the personal theme default. Text presets change typography while retaining text, position, alignment and decorative choices. Automatic text color accounts for custom board backgrounds. Changes save locally for guests or persist/sync with the team; viewers cannot edit; undo and field conflicts remain enforced. Not deployed.
- Done when: Background changes and styled annotation text persist, appear consistently for teammates and do not alter the existing note formatting behavior.

### IDEA-004: Dark theme

- Type: Feature / UI
- Priority: Soon
- Status: Done
- What I want: A toggleable dark theme that persists for the signed-in account.
- Expected behavior or example: Users can choose Light, Dark or System. The choice survives logout/login and follows the account across devices. Browser-local mode can remember its choice on that device.
- Reference links or screenshot paths:
- Constraints or things to preserve: Theme preference is personal, not a shared board setting. Preserve intentionally chosen card/background colors and uploaded media. Maintain readable contrast and clear tool/selection states.
- Done when: The interface consistently applies the chosen theme, the account preference is stored on the backend, and logout/login restores it.
- Result: Light/Dark/System controls are available on the entry screen and in the editor Account menu. Account choices persist in PostgreSQL and reload on login, page reload and window focus; browser-local mode keeps a separate device preference. System responds to operating-system changes. Shared card colors and uploaded media retain their appearance. Permission/CSRF/session-revocation tests and Chromium account/device/mobile/accessibility checks pass. Implemented on the feature branch; not yet promoted to production.

### IDEA-005: Cleaner top bar and workspace/board navigation

- Type: Improvement / UI
- Priority: Now
- Status: Done
- What I want: Simplify the confusing combination of Workspaces, Boardroom, Workspace and Creative studio. Make the app, the selected team workspace and the current board easy to distinguish.
- Why it matters: Users should immediately understand where they are and how to change workspaces or navigate boards.
- Expected behavior or example: The header shows the Boardroom logo, the actual workspace name with a switcher, and compact save/team/account controls. The canvas heading shows the current board title, with breadcrumbs for nested boards. Example: header "Boardroom | Design team"; board heading "Creative studio". Import/export and less frequent actions live in a menu.
- Reference links or screenshot paths:
- Constraints or things to preserve: Original Boardroom branding, workspace switching, nested-board navigation, title editing, permissions, member/invitation controls and clear local/team save or conflict status. Keep local mode clearly labeled. Coordinate the layout with the floating annotation toolbar from IDEA-002.
- Done when: Generic/repeated navigation labels are replaced by a clear hierarchy, important actions remain discoverable, and the header and floating controls fit at supported screen sizes.
- Result: Header separates Boardroom branding from a workspace-name dropdown with direct team/local switching and access to all workspaces. Account actions and owner team controls remain available; save/conflict status stays visible. Board title editing and full nested breadcrumbs live in the canvas heading. Import/export and shortcuts are under Actions. Compact layouts retain essential navigation and save status. The annotation toolbar remains IDEA-002.

### IDEA-006: Media inspection and editing

- Type: Feature / Improvement
- Priority: Soon
- Status: Idea
- What I want: Fullscreen image/video viewing, optional captions, image crop/rotate and image-attached annotations.
- Expected behavior or example: Open media in a focused viewer; image annotations move and resize with their image. Keep the uncluttered canvas presentation from IDEA-001.
- Constraints or things to preserve: Private authorized media access, original downloads, aspect ratio, playback controls and accessible keyboard navigation. Define whether image edits are reversible transformations or new assets before implementation.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/359381-images
- Done when: Authorized users can inspect media and use the delivered editing tools without losing originals; shared changes persist and respect permissions.

### IDEA-007: Comments, mentions and team feedback

- Type: Feature
- Priority: Soon
- Status: Idea
- What I want: Board/card comment threads, replies, @mentions, unread notifications and resolved feedback.
- Why it matters: Teams can discuss work in context instead of using an external chat to explain which item they mean.
- Delivery stages: Persisted threads and replies first; mentions and in-app notifications next; optional email notifications and reactions later.
- Constraints or things to preserve: Check access for comments and notification recipients; revoked users must lose access. Existing viewers remain read-only unless an explicit commenter permission is introduced in IDEA-012.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/425042-collaborating-in-real-time
- Done when: Authorized teammates can discuss and resolve feedback, receive mentions and find unread threads after reload.

### IDEA-008: Workspace search and board discovery

- Type: Feature / Improvement
- Priority: Soon
- Status: Idea
- What I want: Search across authorized boards, jump to matching cards, and access recent and favorite boards.
- Expected behavior or example: Results show board names and breadcrumb locations; selecting a result opens the board and brings the card into view. Optional tags, board icons/covers and an overview can follow.
- Constraints or things to preserve: Search and previews must never reveal inaccessible board content. Favorites and recent-board lists are personal preferences. Coordinate with IDEA-005.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/1116205-search
- Done when: Users can find content beyond the current board and navigate directly to results with permission checks.

### IDEA-009: Full board duplication and team templates

- Type: Feature
- Priority: Later
- Status: Idea
- What I want: Duplicate entire boards, including nested boards, and save reusable team templates for briefs, moodboards and project plans.
- Constraints or things to preserve: Remap board/card/connector IDs and internal references without cycles. Define private asset ownership and cross-workspace copying; do not silently reuse unauthorized asset references.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/1945249-custom-templates
- Done when: A duplicated board tree is independent of its source, and authorized users can create new boards from a template without changing the original.

### IDEA-010: Structured tasks and reminders

- Type: Feature / Improvement
- Priority: Later
- Status: Idea
- What I want: Tasks with individual IDs, assignees, due dates, reminders, indentation and drag-to-reorder.
- Why it matters: Current checklists are stored together as text; individual task operations would reduce conflicts when teammates edit different tasks.
- Delivery stages: Migrate existing checklist content safely to structured tasks first; add assignments and dates, then reminders using the notification foundation in IDEA-007.
- Constraints or things to preserve: Existing checklist text/completion states, undo/redo, live updates and permission boundaries. Assignees must have access; date/time and reminder behavior must be explicit.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/10486983-to-do-lists
- Done when: Separate task edits merge appropriately and assignments, dates and delivered reminders survive reload.

### IDEA-011: Rich links and research capture

- Type: Feature
- Priority: Later
- Status: Idea
- What I want: Link titles, preview images and descriptions; a per-board Unsorted inbox; eventually a browser web clipper for links, images and selected text.
- Expected behavior or example: Capture references without choosing a canvas position, then drag them from the inbox onto the board. Preserve source URLs.
- Delivery stages: Safe link previews first, then the inbox; a web clipper is a separate later slice. Broader supported embeds may follow.
- Constraints or things to preserve: Server-side preview fetching needs SSRF protection, redirect validation, bounded downloads and timeouts. Unsorted content follows board permissions. Keep external embeds explicit and allowlisted.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/1722065-links ; https://help.milanote.com/en/articles/111399-unsorted-notes
- Done when: Delivered capture tools preserve sources, previews fail safely and inbox content persists with authorized access.

### IDEA-012: Board-specific access and controlled sharing

- Type: Feature
- Priority: Later
- Status: Idea
- What I want: Board-specific access, a commenter role and optional expiring read-only links for clients or contractors. Password-protected links can follow.
- Delivery stages: Define board permission inheritance and commenter capabilities first. Public/guest links remain a separate opt-in feature and do not authorize deployment.
- Constraints or things to preserve: Enforce access consistently across HTTP, WebSockets, media, search, exports and notifications. Define nested-board inheritance, revocation and link expiry; tokens must not expose private workspace content.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/4324593-sharing-a-board
- Done when: Users can share only intended boards, commenter actions are explicit, and revocation closes every applicable access path.

### IDEA-013: Trash, recovery and board history

- Type: Feature / Improvement
- Priority: Soon
- Status: Idea
- What I want: Recover deleted cards and boards from a user-facing trash, then add board snapshots and activity history.
- Why it matters: Current undo is in memory and administrator backups are not a convenient way to recover a teammate's accidental deletion. Deleting a board tile currently leaves its child board in the snapshot.
- Delivery stages: Define board/sub-board deletion and restore semantics first; implement trash, then snapshots and history.
- Constraints or things to preserve: Retain required media until recovery retention expires; restoration must respect current permissions and concurrent changes. Define retention and permanent deletion separately from administrator backups.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/10583739-the-trash
- Done when: Deleted content can be found and restored after reload, including nested boards and media, without dangling references or unauthorized access.

### IDEA-014: Useful exports and presentation view

- Type: Feature
- Priority: Later
- Status: Idea
- What I want: PNG/PDF board exports, Markdown/text notes, a media ZIP download and a clean presentation view.
- Constraints or things to preserve: Export only authorized content and fetch private media through authorized paths. Define nested-board scope, large-board handling and fidelity. Existing JSON export remains a document backup and excludes media bytes.
- Reference links or screenshot paths: https://help.milanote.com/en/articles/111395-exporting-your-work
- Done when: Delivered formats reproduce supported content accurately and presentation mode hides editing controls while retaining readable navigation.

### IDEA-015: Canvas organization and connector polish

- Type: Improvement / UI
- Priority: Soon
- Status: Idea
- What I want: Zoom to fit, optional snapping/alignment guides, align/distribute actions, lock position, layer ordering and drag-to-reorder columns. Connectors should support labels, line styles and adjustable attachment points.
- Delivery stages: Zoom to fit and alignment first; locking/layers and column reordering next; richer connectors afterward. A minimap is optional if large-board navigation still needs it.
- Constraints or things to preserve: Consistent coordinates at every zoom level, keyboard access, group movement, undo/redo and live conflict handling. Define whether locking is a shared property and how layers interact with annotations.
- Done when: Delivered tools make spatial organization predictable without disrupting existing drag, selection, resize and panning behavior.

### IDEA-016: Collaboration and offline resilience

- Type: Improvement
- Priority: Later
- Status: Idea
- What I want: Visible collaborator cursors/editing indicators, finer-grained rich-text collaboration and a bounded durable offline operation queue.
- Current behavior: Member presence and field-level live operations work. Same-field rich-text edits conflict explicitly; pending operations survive disconnects only while the tab stays open.
- Delivery stages: Editing indicators/cursors first; design text collaboration separately; persist offline operations with safe replay and explicit recovery states.
- Constraints or things to preserve: Recheck access on replay, isolate queued data by account/workspace, handle logout/revocation, retain idempotent operation IDs and never silently overwrite remote edits. Browser-local storage is not team sync.
- Done when: Each delivered capability is tested for competing edits, disconnect/reload, stale queues and revoked access; remaining conflict limits stay documented.

### IDEA-017: Touch, stylus and broader content options

- Type: Feature / Improvement
- Priority: Later
- Status: Idea
- What I want: Intentional touch/stylus interactions and responsive controls; eventually audio cards, document/PDF previews, tables or maps where team workflows justify them.
- Delivery stages: Validate existing workflows on touch devices and multiple browsers before expanding content types. Treat each new content type as a separately scoped slice.
- Constraints or things to preserve: Accessible controls, private asset access, safe document rendering and clear gesture distinctions between drawing, dragging and panning. These are exploratory additions, not claims of current feature parity.
- Done when: Delivered device workflows pass manual acceptance and each added content type has defined persistence, permissions and editing behavior.

## Suggested delivery slices

Prioritize IDEA-033 dialog windows, IDEA-034 PDF export and IDEA-035 workspace styles next, as requested by the user. IDEA-029 through IDEA-032 have been delivered. IDEA-026 through IDEA-028 have been delivered. IDEA-018 through IDEA-025 have completed local implementation and validation and remain available for review. The older proposed sequence below follows these improvements. Pending requests remain ideas rather than implemented features.

1. Clean up the header/navigation and media presentation (IDEA-005 and IDEA-001), and settle the placement of the separate annotation toolbar.
2. Establish shared interface color tokens and account-persistent themes (IDEA-004).
3. Deliver basic drawing with the floating annotation toolbar (first stage of IDEA-002).
4. Add standalone text annotations and their styling, board background controls, then optional shapes/textures (IDEA-002 and IDEA-003).
5. Add comments and mentions (IDEA-007), with focused media viewing from IDEA-006 where useful for review.
6. Improve workspace search/navigation and recoverable deletion (IDEA-008 and IDEA-013).
7. Add full board duplication/templates and rich link previews, followed by the Unsorted inbox (IDEA-009 and IDEA-011).
8. Expand tasks, board-specific sharing and useful exports (IDEA-010, IDEA-012 and IDEA-014).

Canvas polish (IDEA-015) can accompany the relevant editor slices. Collaboration resilience (IDEA-016) needs its own design and validation. Touch/stylus acceptance and advanced content types (IDEA-017) follow demonstrated team needs. Older priorities remain proposals; IDEA-026 through IDEA-028 are explicitly prioritized and marked Ready by the user.

## Quick ideas

<!-- Add more ideas below, one per bullet. You can include examples or screenshot paths. -->

## Optional request template

```markdown
### IDEA-044: Short title

- Type: Feature / Improvement / Bug / UI
- Priority: Now / Soon / Later / Unsure
- Status: Idea / Ready / In progress / Done / Deferred
- What I want:
- Why it matters:
- Expected behavior or example:
- Reference links or screenshot paths:
- Constraints or things to preserve:
- Done when:
```

For bugs, include what you did, what happened and what you expected. For UI changes, a reference image or a description of the interaction helps. Leave fields blank if you are unsure.

## Using this with Codex

- **"Review docs/BACKLOG.md"**: compare ideas with the current app, identify existing features, group related requests and suggest priorities or implementation steps.
- **"Implement IDEA-001"**: work on that specific request and update its status with validation and remaining limits.
- **"Work through the Ready items in docs/BACKLOG.md"**: implement those items in priority order, checking dependencies and preserving the existing editor.

Keep completed requests here with a short result so we retain the context. Implementation work should also update the roadmap when it changes milestones or documented limits. Existing project instructions, including keeping deployment separate, still apply.
