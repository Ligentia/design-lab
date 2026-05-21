# DM Customer settings & multi-card rule creation

Customers tab + Delivery routing flows with strict-match search, grouped results, and multi-card rule creation across both SIPs. Builds on the original "DM Client settings exploration 1".

## Suggested metadata for re-upload (review before uploading)
- Title: DM Customer settings & multi-card rule creation
- Description: Add-customer flow with strict-match search, table-format grouped results, info banners, and multi-card rule creation in both the Customers SIP and the Delivery routing SIP. Includes the Client → Customer rename, per-mode SIP layouts (create vs edit), and a routing-SIP modal that seeds rule cards from search results.
- Creator: Chuka
- Date: 2026-05-21
- Tags: prototype, exploration, customers, delivery-routing, multi-card, search
- Folder: prototypes/dm-customer-settings-multi-card-rules
- Design Lab ID: dm-customer-settings-multi-card-rules

## Original metadata (kept for reference)
- Title: DM Client settings exploration 1
- Description: Initial explorations of DM client settings
- Creator: Chuka
- Date: 2026-05-18
- Tags: prototype, exploration
- Folder: prototypes/dm-client-settings-exploration-1
- Design Lab ID: dm-client-settings-exploration-1

## Changelog

### Settings navigation
- Sub-tab order: **Notification alerts** moved before **Warehouse management**.
- Section tabs renamed: **Client settings** → **Delivery**, **Your settings** → **Shipment Approval** (Coming soon chip preserved).
- Top-bar customer selector defaults to empty ("Select customer" muted placeholder); un-greys on selection.
- **Hide inactive** toggle is disabled while the Customers sub-tab is active.

### Customers tab table (formerly Clients tab)
- Columns updated to match Figma: **Customer | Customer code | Ligentix customer id | Legal entity name | Cargowise code**.
- Rebuilt sample data (Apollo, Hobbycraft, River Island, three TFG legal entities, The Works, White Stuff).
- Column widths redistributed (25/17/17/21/20%).

### Delivery routing tab
- Removed the **Add customer** and **Add customer-M** buttons from the table toolbar (Create new rule remains).
- Per-row copy icon (edit-btn) and right-click context menu added; the context-menu Duplicate / Deactivate / Delete actions detect which table the row belongs to (booking vs routing).
- Table columns updated to match Figma: dropped **Ligentix ID** + **CW consignee** chips; renamed to **Customer code** + **CargoWise code**; added **Alert days** and **Pin/Badge email(s)** before Status.
- Customer cell shows `"Customer - LegalEntity"` when a legal entity is present; plain customer name otherwise.
- New **Pin/Badge** cell renders as a green chip when "Required", plain text when "Not required".

### Booking rules SIP
- **Copy existing rule** button + dropdown removed; trash button next to title removed.
- Added two tabs under the title: **Amend rule** / **Log** (Log shows an empty-state placeholder).
- Footer split: **Amend rule** (primary) + **Delete rule** (outlined red) on the left, **Deactivate rule** toggle on the right.
- Tabs / Delete / Deactivate only appear when editing an existing row. The Create-new-rule SIP keeps the simple form + "Create rule" button.

### Delivery routing SIP
- Mirrors the booking-rules SIP edit/create mode pattern (tabs + Delete + Deactivate only in edit mode).
- Form restructured into a multi-card layout with **+ Add another rule** below the cards.
- Each card has a collapsible header (chevron right). Auto-created cards are **not** deletable; user-added cards have a trash icon (left).
- Footer (create mode): **+ Add Customer** (outline, left) → opens the Add Customer modal; **Create rule** (primary, right) → closes SIP + toast.
- Info banner under the first card's **When** field: *"If you can't find a customer, you can add them to DM by using the 'Add Customer' button below."* Banner disappears once the user clicks the Add Customer button.
- "+ Add another rule" inherits the customer from the first card's When field (or shows the related-entity dropdown if a multi-entity result was added).

### Customers SIP — Add customer flow
- **Step 1 — search:**
  - Label updated to *"Cargowise code or Ligentix ID **(Code/ID must be a strict match)**"*.
  - Inline **Search** button (live-search removed).
  - 8-row customer dataset shared with the modal.
  - Match logic: strict (case-insensitive equality) on customer code / Cargowise code / Ligentix ID, contains-match on customer name / legal entity name.
  - Group expansion: any matched row pulls in every row sharing its Ligentix ID, so searching `TFGGBWLF`, `105767`, `Hobbs`, `WHISTLGBLHR`, or `Phase Eight` all return the 3 TFG entities.
  - Results render in a **table** with even-width columns (`colgroup` enforces 33%/33%/33% or 50%/50%): multi-entity rows show **Legal entity | Cargowise code | Ligentix client id**; single-entity rows show **Customer name | Cargowise code**.
  - Above the table: *"X result(s) found"*.
  - Below the dark section: a blue info banner — *"To add this customer, you're going to need to set up at least one routing rule."* Banner only shows when there are results.
  - Table is purely informational — no hover highlight, no row selection (overrides the global `tbody tr` hover rule).
  - **Next - create rule** button stays disabled until results exist.
- **Step 2 — rule cards:**
  - Clicking Next auto-generates one rule card per search result.
  - Multi-entity results pre-fill **When** as `Customer - LegalEntity` (e.g. *TFG - Hobbs*); single-entity results pre-fill with the customer name.
  - Every card's When dropdown contains the full set of related labels so the user can swap entities.
  - **+ Add another rule**: single-result context pre-selects the customer; multi-result context leaves When empty but populates the dropdown with the related entities.
  - Card title is **Create rule** (not "Create new rule").
  - Auto-generated cards are **not** deletable; manually added cards (via + Add another rule) get the trash icon on the left of their header.
  - Final toast: *"[Customer] added, and routing rule(s) created successfully. Please go to Delivery routing to see your routing rules."*

### Add Customer modal (Delivery routing → + Add Customer)
- Mirrors Customers SIP step 1: same label, hint, search button, strict-match logic, table-format grouped results, *"X results found"* count, blue info banner.
- Submit button labelled **Add customer** (was *Add client & create new rule*); disabled until results exist.
- On submit:
  - Closes the modal.
  - First search result is poured into the existing default routing rule card (only the **When** dropdown is rewritten — other fields the user has touched are preserved).
  - Remaining results each append a new card.
  - Each card's When dropdown contains the full set of related entity labels (so any card can be swapped to a sibling entity).
  - Cards added via the modal are **not** deletable.
  - Toast fires with the customer name(s) added.

### Client → Customer rename
- All user-visible occurrences of *Client / client* → *Customer / customer* (sub-tabs, descriptions, column headers, aria-labels, modal title, section headers, SIP title, sample data names).
- Code identifiers (`#clientsTable`, `#addClientBtn`, `#clients-sip`, `openClientsSip`, `clientRows`, etc.) were left intact to avoid breaking references.

### Misc fixes
- Faded text bug: the `.placeholder` class (which is only meant for `<select>` empty-state styling) was being applied to text inputs by selectors like `.sip-select`. Scoped all such selectors to `select.sip-select` so typed text in inputs (CW code field, notification emails, etc.) renders in the regular dark colour.
- Results table border made visible by switching `border-collapse: collapse` → `separate` (the rounded `overflow: hidden` was clipping the outer border under `collapse`) and bumping the outer border to `#d0d5dd` so it reads against the modal's white background.

## Re-uploading to Design Lab
1. Edit the prototype files as needed.
2. Go to https://design-lab-rouge.vercel.app and click "Add prototype".
3. Upload the edited HTML file.
4. Review and update every field — the "Suggested metadata for re-upload" section above lists the current best-guess values, but double-check them:
   - **Title**: confirm it still reflects the latest direction.
   - **Description**: confirm it summarises what changed since the previous upload.
   - **Creator**: change to whoever is uploading this version.
   - **Tags**: add or remove tags to match the current state.
   - **Folder**: if the title, description, creator, or tags have changed, always use a NEW folder path (this is a new prototype). Only keep the same path for minor bug fixes where nothing else has changed.
