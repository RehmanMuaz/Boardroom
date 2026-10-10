# Boardroom ideas and improvements

Use this file for features, UI changes, bugs and anything you want to improve. Plain bullet points are enough; the detailed template below is optional.

These are proposed ideas. [README](../README.md) describes implemented behavior, and [ROADMAP](ROADMAP.md) tracks milestones and remaining work.

## Requests

IDEA-018 through IDEA-024 are implemented and locally validated on feature/backlog-editor-improvements, awaiting user review. Existing requests follow these improvements. No deployment or remote publication was performed.

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
- What I want: A dedicated line tool, separate from shape annotations, connects two notes/items. Each endpoint attaches to its item's center and follows the item as it moves. The connector and arrow must render above objects so the arrow is always visible.
- Expected behavior or example: Connect two notes, move or resize either note, and the line stays attached to their current centers without disappearing behind cards or columns.
- Constraints or things to preserve: Reuse existing item connectors where appropriate. Keep free-drawn annotation shapes distinct from attached connectors. Preserve zoom/pan alignment, undo/redo, persistence and permissions. Item layer ordering in IDEA-021 must not hide connectors.
- Done when: The dedicated tool creates center-attached connectors between two items; moving/resizing either endpoint updates the line, and the arrow remains visible above canvas objects.
- Result: The separate Line tool in the creation rail connects the first and second selected items. Straight arrows attach to their centers and track movement/resizing; a dedicated overlay above all allowed object layers and a light outline keep lines/arrowheads visible. The existing Connect cards action remains available; drawing shapes stay separate.


### IDEA-021: Move objects in front of or behind others

- Type: Feature / Improvement
- Priority: Now
- Status: Done locally; awaiting user review
- What I want: Controls to bring an object forward, send it backward, bring it to the front or send it to the back.
- Constraints or things to preserve: Layer order persists, syncs and supports undo/redo. Define ordering for cards, columns and annotations consistently with IDEA-015. Connectors from IDEA-020 retain their visible overlay behavior.
- Done when: Users can change overlapping objects' front/back order predictably, and that order survives reload and appears consistently for teammates.
- Result: Arrange offers Bring forward, Send backward, Bring to front and Send to back for selected cards or annotations. Shared, bounded layers preserve relative group order and keep columns behind their children; connector overlays remain above objects. Undo/redo, reload, operation validation and viewer restrictions are covered.


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

IDEA-018 through IDEA-024 have completed local implementation and validation; review them before selecting further work. The older proposed sequence below follows these improvements. Pending requests remain ideas rather than implemented features.

1. Clean up the header/navigation and media presentation (IDEA-005 and IDEA-001), and settle the placement of the separate annotation toolbar.
2. Establish shared interface color tokens and account-persistent themes (IDEA-004).
3. Deliver basic drawing with the floating annotation toolbar (first stage of IDEA-002).
4. Add standalone text annotations and their styling, board background controls, then optional shapes/textures (IDEA-002 and IDEA-003).
5. Add comments and mentions (IDEA-007), with focused media viewing from IDEA-006 where useful for review.
6. Improve workspace search/navigation and recoverable deletion (IDEA-008 and IDEA-013).
7. Add full board duplication/templates and rich link previews, followed by the Unsorted inbox (IDEA-009 and IDEA-011).
8. Expand tasks, board-specific sharing and useful exports (IDEA-010, IDEA-012 and IDEA-014).

Canvas polish (IDEA-015) can accompany the relevant editor slices. Collaboration resilience (IDEA-016) needs its own design and validation. Touch/stylus acceptance and advanced content types (IDEA-017) follow demonstrated team needs. Priorities and this sequence are proposals; no new item is marked Ready.

## Quick ideas

<!-- Add more ideas below, one per bullet. You can include examples or screenshot paths. -->

## Optional request template

```markdown
### IDEA-025: Short title

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
