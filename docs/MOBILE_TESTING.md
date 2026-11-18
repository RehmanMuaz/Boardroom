# Mobile canvas preview

This development slice adapts the existing web app; no separate mobile app or workspace migration is required. Use the private Tailscale preview with Tailscale connected on the phone, then refresh the page. Continue as guest is enough for canvas testing; uploads and team collaboration still require a team workspace.

- Pan with one finger. Tap an item to select it; double-tap text to edit.
- Pinch with two fingers to zoom and pan. Adding a second finger cancels a current item drag or unfinished drawing.
- Choose **Move items**, then drag selected items. Choose **Pan** to return to navigation.
- Enable **Multi-select**, tap items, then use the group icon beside the selection. Tap it again to ungroup.
- Tap a creation tool in the bottom strip, then tap its canvas position. A pinch cancels placement.
- Tap **Properties** to expand selected-object settings; **Hide properties** collapses them and **Tools** restores creation tools.

Mouse/keyboard workflows and the desktop sidebar keep their existing layout. Saved workspace JSON, SQL, original uploads and permission boundaries are unchanged. Touch modes and panel expansion are temporary device UI state.

Automated coverage uses real Chromium touch events and phone viewport sizes. Actual Safari/iOS or Android keyboard behavior, native video controls, stylus and extended landscape/tablet use still need physical-device acceptance. Production has not received this slice.
