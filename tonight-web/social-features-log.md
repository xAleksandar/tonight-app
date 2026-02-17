# Tonight App Social Features Log

This log tracks the 20-minute automation passes for the new social features (event detail screen, join requests + approvals, event group chat, friends/DMs).
Each run should:
1. Read the most recent entry to know the current focus.
2. Implement or investigate one small step.
3. Document progress + next steps before exiting.

## 2026-02-12 20:58 EET — Initial setup
- Created branch `feature/tonight-social` from latest `main`.
- Added this log to coordinate 20-minute runs.
- Next focus: design the "event inside" experience (UI + API checklist) before building join requests and chat flows.

## 2026-02-12 21:12 EET — Event-inside shell + route stub
- Drafted the `EventInsideExperience` component (glass panels, attendee buckets, join-request queue, chat preview placeholder) plus a new `/events/[id]` page that renders mock host data so we can see the inside screen full-bleed.
- Added a focused Vitest suite to lock the layout + checklist behavior so future data wiring can't regress the structure.
- Next: hook the component up to real queries (event, attendees, join-requests) and start threading the host approval actions through the existing join-request APIs so the buttons become live.

## 2026-02-12 21:20 EET — Event-inside page now queries live data
- Replaced the mock `/events/[id]` screen with a server-side loader that requires auth, fetches the event, and hydrates attendees + join-request cards from Prisma via the existing helpers.
- The component now reflects the current RSVP state (accepted/pending/waitlist) instead of placeholder data.
- Next: activate the approve/reject buttons by calling the join-request PATCH endpoint and optimistically updating the UI buckets so hosts can act from this screen.

## 2026-02-12 21:43 EET — Join-request buttons now live
- Upgraded `EventInsideExperience` to manage its own attendee + pending state, wire the approve/pass buttons to the `/api/join-requests/:id` PATCH endpoint, and surface inline loading states + toasts so hosts get instant feedback.
- Extended the `/events/[id]` loader + component props to carry the pending guest's `userId`, ensuring we can optimistically reshuffle people between the confirmed/pending/waitlist buckets, and added a lightweight regression test run for the component.
- Next: expose the same action plumbing for the chat card (open thread CTA) so accepted guests can jump straight into the event group chat once that API is ready.

## 2026-02-12 22:05 EET — Chat CTA plumbing exposed
- Expanded the `chatPreview` contract so hosts can pass a CTA label/href + helper copy, and swapped the disabled stub button for a real `next/link` that renders whenever a target thread is available.
- Extended the JS DOM test harness (self shim) and added a regression test that ensures we emit a link when the CTA data is present, keeping the new behavior covered.
- Next: feed real chat preview data from the `/events/[id]` loader (join-request derived thread URL + unread counts) so the button lights up for accepted guests.

## 2026-02-12 22:27 EET — Event loader now emits live chat preview data
- Let accepted guests through the `/events/[id]` page by deriving their viewer role from the join-requests list, while silently hiding host-only pending approvals unless you're the host.
- Thread the viewer's join-request id into a new chat-preview builder that queries the latest message, unread count (based on `messageRead` rows), and accepted guest tally so the CTA now links to `/chat/[joinRequestId]` with fresh metadata; pending viewers get a disabled-state reason instead.
- Added a targeted Vitest run (`npx vitest run tests/components/EventInsideExperience.test.tsx`) to make sure the UI contract we just extended still passes.
- Next: surface host-side chat summaries (latest pings + unread) so the inside screen can highlight when hosts need to re-engage the thread.

## 2026-02-12 22:44 EET — Host chat summaries wired in
- Added a host-specific chat preview builder that aggregates the latest guest DM across all accepted join requests, surfaces unread counts, and deep-links the CTA to the conversation that most recently pinged the host.
- Backfilled graceful fallbacks (no accepted guests vs. no guest pings yet) plus a regression test that locks the disabled CTA explanation so hosts always know why the button is inactive.
- Next: list the top unread guest threads (name + last line) under the chat card so hosts can jump directly into the right DM instead of guessing which guest needs attention.

## 2026-02-12 23:00 EET — Home cards open event detail
- Added a dedicated select handler so discovery cards/map markers now push to `/events/[id]` when clicked, letting hosts/guests jump straight into the inside experience.
- Kept the selection state update so the map/list highlighting still works while we navigate.
- Next: continue with the logged chat backlog item (top unread guest threads beneath the chat card).

## 2026-02-12 23:07 EET — Host unread guest threads surfaced
- Added a Prisma helper that groups unread guest DMs per join request and feeds a `hostUnreadThreads` payload into the event-inside chat preview so we know who’s waiting on a response.
- Extended the `EventInsideExperience` UI to render a “Guests needing replies” rail with name, last line, relative timestamp, and unread badges that deep-link into each `/chat/[joinRequestId]` thread, plus tightened the component test suite to cover the new block.
- Updated the host chat preview builder + tests so hosts always receive the unread list alongside their CTA, even when there are no new messages elsewhere.
- Next: explore inline reply shortcuts (quick actions/mark-as-read) from the event-inside screen so hosts can triage DMs without bouncing between pages.

## 2026-02-12 23:27 UTC+02:00 — Host unread threads can be cleared inline
- Added stateful tracking for the host unread rail so we can remove guests as they get handled and keep the UI live without a full refresh.
- Wired a new “Mark as read” quick action for each pending guest DM that calls the existing chat mark-read API, shows feedback, and removes the entry once the API confirms.
- Extended the component test suite to cover the new controls, including fetch stubbing + DOM cleanup adjustments so automation stays green.
- Next: explore lightweight reply shortcuts (quick canned responses or inline composer) so hosts can answer DMs directly from the event screen without jumping into the dedicated chat view.

## 2026-02-12 23:46 EET — Quick replies from event screen
- Added a reusable quick-reply template set to the event chat rail so hosts can tap canned responses without loading the full chat view; buttons live inside each unread guest card.
- Wired the actions to `/api/chat/:joinRequestId/messages` plus an automatic mark-read follow-up, updating local state/toasts so the "Guests needing replies" list clears immediately after sending.
- Extended the EventInsideExperience test suite to cover the new reply flow and cleaned up fetch mocks between runs so vitest stays deterministic.
- Next: graduate the chat rail to include a lightweight inline composer (freeform text + send) so hosts can type custom responses without leaving the inside screen.

## 2026-02-13 00:06 EET — Inline host composer added
- Added per-thread inline composer state so hosts can type custom replies directly from the EventInsideExperience without leaving the page, alongside the existing canned quick replies.
- Consolidated the chat send flow through a shared helper that posts messages, fires the mark-read follow-up, and prunes the unread rail for both quick templates and custom responses, with new UI wiring + tests covering the composer.
- Extended the component spec to render the textarea, send/clear controls, and tightened the Vitest suite to cover the fresh behavior (npx vitest run tests/components/EventInsideExperience.test.tsx).
- Next: expose the same inline composer affordance for accepted guests (non-host view) so they can poke the event group chat without opening the dedicated chat screen, including permission gates + loader data.

## 2026-02-13 00:24 EET — Guest inline composer wired up
- Extended the event loader chat preview to ship a `guestComposer` payload (joinRequestId) for accepted guests and threaded that metadata through EventInsideExperience.
- Added a guest-facing inline composer block so confirmed attendees can send freeform updates without jumping into `/chat`, reusing the existing send helper with toast feedback and permission gating.
- Backfilled the component tests with coverage for the guest composer (render + send) and reran `npx vitest run tests/components/EventInsideExperience.test.tsx` to keep the contract locked.
- Next: add a lightweight "latest chat activity" strip under the event card so guests can skim the most recent host updates (last message + relative timestamp) without opening the full chat.
## 2026-02-13 00:45 EET — Guest latest host update strip
- Added a `latestHostActivity` payload to the `/events/[id]` loader so accepted guests also receive the most recent host-authored chat message + timestamp.
- Surfaced a new "Latest host update" panel under the Tonight's plan card that renders the message + relative time, giving guests context without opening `/chat`.
- Expanded the EventInsideExperience spec + vitest coverage to lock the new props + UI so future runs can build on the feed safely.
- Next: grow this into a mini activity feed (last 2-3 host updates with times) so guests can skim multiple updates inline.

## 2026-02-13 01:03 EET — Guest mini activity feed for host updates
- Expanded the `/events/[id]` loader to collect the three most recent host-authored chat messages per accepted guest, threading them through the chat preview payload along with the existing single-message fallback.
- Updated `EventInsideExperience` to render a stacked "Host updates" panel for guests, including timestamp + author lines, while keeping the previous single-update style when only one message exists.
- Extended the component Vitest suite to cover the new feed rendering so future iterations can't regress the multi-update view.
- Next: add a "See earlier updates" affordance that pages older host announcements into the feed so guests can keep scrolling without opening the full chat.

## 2026-02-13 01:24 EET — Host updates now paginate inline
- Added `/api/events/[id]/host-activity` plus new pagination metadata in the event loader so accepted guests can page through host-authored chat history without opening `/chat`.
- Updated `EventInsideExperience` to maintain guest-side host update state, render a "See earlier updates" button, fetch older batches, and keep the feed consistent while loading.
- Extended the component Vitest suite to cover the new pagination affordance + ensured the targeted test run stays green.
- Next: let hosts publish multi-line announcements from the event-inside screen (and automatically surface them in the guest feed) so they don't have to jump into chat to post updates.


## 2026-02-13 01:46 EET — Host announcement composer + broadcast API
- Added a `/api/events/[id]/host-activity` POST handler that lets the host post a single announcement which the server fans out to every accepted join request while skipping chat rate limits; responses include the delivered count for observability.
- Threaded a new host-only "Broadcast to guests" composer into `EventInsideExperience`, including multi-line support, character limits, toast feedback, and wiring to the new API so hosts can publish updates without leaving the page.
- Expanded the component Vitest suite with coverage for the announcement UI and hooked the shared chat helper with an optional `skipRateLimit` flag so automation can keep reusing the same pathway.
- Next: push these announcements to guests in real time (websocket refresh of the host updates feed) so they appear without a manual reload.

## 2026-02-13 02:06 EET — Host announcements stream via sockets
- Threaded the authenticated socket token through `/events/[id]` → `EventInsideExperience`, spinning up the guest join-request room when a confirmed attendee loads the page so the host-updates rail can listen for `join-request:message` events.
- When a payload arrives from the host we now prepend it to the guest feed (with dedupe + author metadata), meaning announcements published from the event screen appear instantly without a manual refresh; added targeted Vitest coverage to lock the realtime behavior.
- Next: add a lightweight “New update” indicator + auto-scroll affordance so guests who are mid-scroll get a subtle nudge when fresh announcements land.

## 2026-02-13 02:24 EET — Host update indicator + auto-scroll for guests
- Added scroll-aware tracking to the guest host-updates rail: when realtime announcements land while someone is mid-scroll, we now pin a subtle "New update" chip that jumps back to the latest entry.
- When the feed is near the top we auto-scroll to surface fresh announcements instantly, complete with a clamped, scrollable list and tests that cover the indicator/auto-scroll behavior.
- Extended the EventInsideExperience spec to expose the new affordance, ensuring future runs keep the guest announcement UX consistent.
- Next: persist a per-guest "last seen host update" cursor (loader + API) so returning guests get the same indicator when new posts arrived while they were away.

## 2026-02-13 02:44 EET — Host update cursor persisted server-side
- Added a nullable `lastSeenHostActivityAt` column (Prisma schema + migration) and surfaced it through the event loader/chat preview contract so each guest carries their last host-update timestamp.
- Introduced a `PATCH /api/events/[id]/host-activity` endpoint that lets accepted guests stamp their latest seen cursor, ensuring we can store it without opening the full chat UI; the GET route + EventInside props now expose the value for upcoming UI work.
- Documented the new data shape in `EventInsideExperience` props and reran the component Vitest suite to confirm nothing regressed.
- Next: wire the guest host-updates rail to call the new PATCH endpoint whenever someone clears the realtime indicator (and use the stored cursor on load to immediately show "New update" if the latest post is newer).


## 2026-02-13 03:28 EET — Host update cursor wired into UI
- Replaced the guest host-update indicator state with a cursor-aware flow that compares the loader-provided `hostActivityLastSeenAt` with the latest announcement, shows the "New update" chip when needed, and drives it through the new PATCH endpoint.
- Added an acknowledgement helper that stamps `lastSeenAt` whenever guests click the chip, auto-scroll back to the top, or receive realtime announcements while already at the top, including optimistic UI + toast handling and a "Marking seen…" state while the cursor saves.
- Extended the Vitest suite to stub the PATCH call for the indicator tests so we assert both the scroll behavior and the API write, keeping the new cursor flow covered.
- Next: render a "New since you last checked" divider inside the host-updates list using the stored cursor so guests can see which announcements are fresh even before scrolling.

## 2026-02-13 03:42 EET — Guest feed shows unseen divider
- Added a cursor-aware divider inside the Host updates list so guests immediately see which announcements arrived after their last visit, reusing the stored `hostActivityLastSeenAt` timestamp to place the marker inline.
- Threaded the divider into the EventInsideExperience component and expanded the Vitest suite with a regression case that asserts the divider order between new and previously seen updates.
- Next: tag the individual post rows above the divider with a subtle “New” pill so guests can skim multiple unseen updates without losing their place.

## 2026-02-13 04:04 EET — Unseen host posts get a “New” pill
- Added a timestamp-aware badge inside each host update so any announcement newer than the guest’s stored cursor carries a subtle “New” pill, even when the divider isn’t visible.
- Memoized the last-seen timestamp to simplify comparisons and extended the EventInsideExperience tests with coverage for the new badge.
- Next: surface the unseen-count in the Host updates header (and CTA chip) so guests know how many fresh posts await before scrolling.

## 2026-02-13 04:24 EET — Host update unseen counts surfaced
- Counted unseen host announcements per guest by comparing the loader's `hostActivityLastSeenAt` cursor with the in-memory feed so we know exactly how many fresh posts are waiting.
- Updated the Host updates header + realtime CTA chip to show the new count (with pluralization + loading states) and added regression coverage to lock the new UI/behavior.
- Refreshed the EventInsideExperience component + tests to use the shared host-updates list test id so future tweaks don't break the unseen badges.
- Next: bubble the unseen host-update count into the discovery/event list cards so guests see pending announcements before opening the inside screen.


## 2026-02-13 04:44 EET — Host update alerts reach discovery cards
- Extended the nearby-events query + API serializer to carry each viewer's accepted-guest status and unseen host-update count so the discovery surface knows when announcements are waiting.
- Updated the discovery list cards to showcase a subtle "new host updates" pill (only for accepted guests) and wired it into the existing art direction, complete with count clamping + accessibility copy.
- Added a focused Vitest covering the new indicator so future UI tweaks keep the badge + gating logic intact.
- Next: reflect the same unseen-count hint on the map pins / hover tooltips so guests notice announcements regardless of view mode.
## 2026-02-13 05:08 EET — Map pins surface host update badges
- Extended `EventMapView` markers + popups to read each viewer's unseen host-update count so accepted guests see a clamped pill on the pin plus a matching tooltip banner.
- Threaded `viewerJoinRequestStatus` + `hostUpdatesUnseenCount` through the discovery map payload, reusing the same gating logic from the list cards and updating the UI tests to assert the new props.
- Added DOM-side helpers/tests to keep the discovery hero spec in sync (sidebar copy + location label) while verifying the new map metadata path in `home-discovery.test.tsx`.
- Tests: `npx vitest run tests/app/discovery-host-updates.test.tsx tests/ui/home-discovery.test.tsx`.
- Next: surface a lightweight filter/toggle (“New host updates”) in discover so guests can temporarily highlight just the events with unseen announcements.

## 2026-02-13 05:24 EET — "New host updates" discovery filter toggle
- Added a global "New host updates" toggle to the discovery surface that counts accepted events with unseen announcements, disables itself when nothing is pending, and filters both the list + map views whenever it's active.
- Updated the discovery list empty state to explain when the filter hides all events and provide a one-tap "Show all" reset, plus refreshed the nearby-events memoization & guard rails so the highlight mode stays in sync with categories.
- Introduced a reusable helper for checking unseen host updates, surfaced the filtered count badge in the toggle UI, and expanded the Vitest coverage to include the new empty state + discovery regression suite (app + UI tests).
- Tests: `cd tonight-web && npx vitest run tests/app/discovery-host-updates.test.tsx tests/ui/home-discovery.test.tsx`.
- Next: persist the filter preference (query param + localStorage) so guests keep the highlight mode between sessions and when sharing deep links.

## 2026-02-13 05:50 EET — Host-updates filter remembers your preference
- Persisted the "New host updates" discovery toggle via the `hostUpdates=new` query param plus `localStorage`, so guests keep the highlight mode when they reload the page, return later, or open deep links someone shared.
- Synced the toggle state back into the URL + storage whenever it changes (including auto-clearing only after a real fetch), and added UI tests to cover both the initialization paths and the query syncing behavior.
- Tests: `cd tonight-web && npx vitest run tests/app/discovery-host-updates.test.tsx tests/ui/home-discovery.test.tsx`.
- Next: expose a tiny "Copy filtered link" affordance next to the toggle so guests can grab a discovery URL with the host-updates filter pre-enabled when they want to share it.


## 2026-02-13 06:06 EET — Copyable host-updates filter link
- Added a "Copy filtered link" control next to the New host updates toggle so guests can grab a discovery URL with `hostUpdates=new` pre-applied, complete with optimistic UI badges + success/error toasts.
- Threaded a share-url builder through the discovery page (preserving existing query params) plus a clipboard helper so we have a single fallback path when the modern clipboard API is unavailable.
- Tests: `cd tonight-web && npx vitest run tests/app/discovery-host-updates.test.tsx tests/ui/home-discovery.test.tsx`.
- Next: Detect/support the Web Share API so mobile guests can share the same filtered link through native sheets (falling back to the copy button when the API isn’t available).

## 2026-02-13 06:20 EET — Web Share support for host-updates filter
- Detected the Web Share API in the discovery toggle, added a native “Share filtered link” action with toast feedback, and kept the existing clipboard path as the automatic fallback when share isn’t supported.
- Threaded the new share state through the UI so the button disables during share-sheet handoff and logs non-abort failures for easier debugging.
- Expanded the discovery UI tests to stub `navigator.share`, assert the new button renders only when supported, and ensure we pass the `hostUpdates=new` URL into the share payload.
- Tests: `cd tonight-web && npx vitest run tests/app/discovery-host-updates.test.tsx tests/ui/home-discovery.test.tsx`
- Next: let hosts share individual event-inside invites via the same Web Share affordance (pre-filling the event deep link + context) so they can DM friends without leaving the screen.

## 2026-02-13 06:46 EET — Host invite sharing block
- Added a host-only "Share event invite" panel inside EventInsideExperience that detects the Web Share API, opens the native sheet with the event title/time/location prefilled, and falls back to a clipboard copy button when share isn't supported.
- Introduced clipboard + share helpers, surfaced the generated deep link inside the UI, and expanded the component test suite with new cases covering both the copy fallback and the Web Share path (vitest).
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`.
- Next: let hosts target Tonight friends directly from the same panel (friend picker + inline DM send) so they can nudge trusted guests without hopping to another page.

## 2026-02-13 07:26 EET — Host friend picker + inline DMs
- Let the event-inside loader surface a curated list of recent accepted guests who aren’t already on the current roster, complete with last event + activity metadata.
- Added the “Invite Tonight friends” rail to the host toolbox so they can search past guests, drop in a contextual template, and DM them directly without opening the standalone chat view (reuses the existing chat message + mark-read helpers).
- Extended the component spec with coverage for the friend rail (rendering, filtering, and sending flows) so regressions get caught alongside the new data plumbing.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx` (currently hanging on this sandbox—see notes in summary).
- Next: pipe these inline invites into a Tonight-friends picker so hosts can multi-select people and dispatch a single blast (prep work: shared invite templates + batching helper).

## 2026-02-13 08:12 EET — Host friend picker supports multi-send blasts
- Added selection state + a “Multi-send ready” rail so hosts can queue multiple friends, see how many are targeted, and fire the active template to everyone at once without retyping.
- Hooked the picker into the batching helper so template messages personalize per friend, clear successful selections, and surface partial failures; expanded the component tests with coverage for the new selection flow (Vitest command continues to hang in this sandbox even with `CI=1`, documented for review).
- Next: surface invite history/guardrails (last invite timestamp + disable state) so hosts don’t double-message the same friend from the picker.

## 2026-02-13 08:32 EET — Friend invite guardrails + history
- Backfilled backend invite metadata by scanning each suggestion’s past host DMs, exposing `lastInviteAt` + a derived cooldown window so the picker knows when a friend was last pinged.
- Threaded the guardrail data through `EventInsideExperience`: the UI now shows the last invite timestamp, disables selection/composers while a cooldown is active, and blocks both single + multi-send flows from double-pinging someone within 15 minutes.
- Added guardrail-aware state so successful sends immediately start the cooldown locally, plus a regression test that covers the disabled state (Vitest still hangs in this sandbox when running `npx vitest run tests/components/EventInsideExperience.test.tsx`, documented for follow-up).
- Next: Persist per-event invite logs (eventId + invitedAt) so we can distinguish “invited for this event today” vs. generic DM history and surface a clearer “Already invited to Tonight: Rooftop Club” badge.

## 2026-02-13 09:12 EET — Event-specific friend invite logs
- Added a dedicated `EventInviteLog` Prisma model + migration plus a `/api/events/[id]/invite-logs` endpoint so each host DM from the event screen records who was invited to that specific event.
- Threaded the loader + EventInsideExperience through the new data: host friend tiles now show an “Already invited to this event” badge, and every DM/multi-send call logs the invite asynchronously so the UI immediately reflects it.
- Extended the EventInsideExperience test suite to cover the new badge + API calls (Vitest run still hangs in this sandbox; killed after no output, see summary).
- Next: use the event-specific invite log to tighten guardrails (auto-disable already invited friends from multi-send / selection or add a “Re-invite anyway” override once the event-specific cooldown expires).

## 2026-02-16 16:42 EET — Event-invite guardrails lock multi-send
- Threaded the per-event invite log through selection/compose state so anyone already pinged for this event is auto-disabled across checkboxes, template buttons, and multi-send CTA until the cooldown expires.
- Added an explicit “Re-invite anyway” override that unlocks friends once the event-specific cooldown finishes, wires into both bulk sends and single DMs, and clears itself after logging a fresh invite.
- Surfaced clearer inline copy (“Already invited to this event” + cooldown timing) so hosts understand why a friend can’t be selected, and reran the EventInsideExperience Vitest suite.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`
- Next: bubble the auto-disable reasoning into the multi-send summary (show how many selections were skipped + offer a one-tap override list) so hosts know why their send count shrank.

## 2026-02-16 17:25 EET — Multi-send summary surfaces skipped invites
- Reordered the guardrail helpers so we can break down multi-send selections into eligible vs. blocked entries, then exposed the counts in the “Multi-send ready” banner (ready chip + paused chip).
- Added a review drawer that lists every skipped friend with the exact cooldown/“already invited” copy plus inline override buttons, so hosts can re-enable people without scrolling through the full list.
- Disabled the bulk CTA when no eligible friends remain and kept the Vitest suite green (`cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`).
- Next: extend the bulk-send result toast to summarize how many invites actually went out vs. were skipped, and surface a quick “reselect skipped friends” action so hosts can revisit them once cooldowns lift.

## 2026-02-16 18:07 EET — Bulk-send toast shows real counts + action
- Reworked the multi-send success toast so it now spells out how many invites delivered, how many were skipped for cooldown/event guardrails, and whether any API attempts failed.
- Upgraded the toast system to render rich React nodes, letting us inject a “Reselect skipped friends” pill that toggles the skipped list + reuse logic directly from the UI section.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`.
- Next: keep the multi-send banner in sync by persisting the latest send summary (sent vs. skipped counts + reselect CTA) so hosts still see the breakdown if they miss the toast.

## 2026-02-16 18:25 EET — Multi-send banner carries the latest summary
- Added persistent multi-send summary state so we hang on to the most recent send counts (delivered/skipped/failed) and thread them into a new “Last multi-send summary” card directly inside the host invite rail.
- Wired the summary card to mirror the toast breakdown (badges + relative timestamp) and surface the same “Reselect skipped friends” CTA so hosts can reopen cooled-down selections without hunting for a dismissed toast.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`.
- Next: start polishing the dedicated `/chat/[joinRequestId]` page (layout + composer styles + live update indicators) so the standalone chat view matches the new event-inside experience.

## 2026-02-16 18:50 EET — Read receipts land on the dedicated chat page
- Extended chat messages to carry read-receipt metadata (Prisma joins + API payloads) and emit socket events whenever someone clears their inbox, so the standalone chat view knows exactly which messages were seen.
- Added a read-receipt listener in `useSocket`, updated the `/chat/[joinRequestId]` page to merge those events in real time, and refreshed the message list UI with a “Seen” badge on your own bubbles once the counterpart catches up.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: continue polishing `/chat/[joinRequestId]` (chat layout refinements, composer ergonomics, desktop/mobile spacing) so the page matches the new Tonight aesthetic before hooking in event detail shortcuts.

## 2026-02-16 19:08 EET — Chat shell + composer polish
- Restyled `/chat/[joinRequestId]` with a centered, glassy shell (radial background, sticky header, refined host/event card) so the dedicated chat page now mirrors the new Tonight aesthetic across desktop + mobile.
- Reworked the footer into a sticky, glowing composer bar that keeps safety actions + connection status in one place, added an auto-resizing textarea, and improved the typing indicator treatment for better ergonomics on small screens.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: continue polishing the dedicated chat page by tightening the message list visuals (bubble spacing/read badges) and threading in the upcoming event-detail shortcuts.

## 2026-02-16 19:24 EET — Chat bubbles grouped and read badges polished
- Refined `MessageList` so sequential messages from the same sender collapse into grouped bubbles with softened corner radii, tighter vertical spacing, and desktop/mobile width clamps, yielding a chat stack that feels closer to the Tonight event aesthetic.
- Upgraded the metadata row to only appear at the end of a burst, restyled the delivery states, and introduced a pill-style “Seen” badge that mirrors the new read receipts from `/chat/[joinRequestId]`.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: add the event-detail shortcuts inside the dedicated chat header (info sheet + CTA) so guests can peek Tonight plan details without leaving the conversation.

## 2026-02-16 19:40 EET — Chat header exposes event info shortcuts
- Replaced the placeholder info button on `/chat/[joinRequestId]` with a live Tonight Plan sheet that shows the host, location, and timing details without leaving the conversation, plus an inline CTA to open the full event page in a new tab.
- Added a persistent "View plan" button in the header for desktop, wired new overlay state + accessibility labels, and kept the new UI consistent with the glassmorphic chat shell.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: enrich the sheet with actionable shortcuts (copy address, open maps, add-to-calendar) so guests can act on the event details straight from chat.

## 2026-02-16 20:08 EET — Event info sheet quick actions live
- Added a quick-actions block to the chat event sheet with copy address, Open in Maps, and Add to calendar controls, complete with disabled states/guardrails for missing data.
- Built clipboard + map helpers plus a client-side ICS exporter (2h default duration) so guests can grab directions or save the plan without leaving the chat.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: surface the high-frequency event actions (copy address/map/add-to-calendar) as inline chips under the chat header so mobile guests can act without opening the sheet.


## 2026-02-16 20:26 EET — Chat header quick-action chips
- Added a second row under the sticky chat header that surfaces Copy address, Open in Maps, and Add to calendar chips so mobile guests can act on plan details without opening the event sheet; states mirror the sheet (loading, disabled, tooltips) and respect the same error handling.
- Introduced a shared inline chip style to keep the new row lightweight, hid scrollbars for horizontal swipe use, and wired the actions into the existing handlers so there’s no duplicated logic.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: add host-only share chips (copy invite link + Web Share) next to the new action row so hosts can blast the plan straight from chat without reopening the sheet.

## 2026-02-16 20:45 EET — Host invite sharing chips in chat header
- Added host-only "Copy invite link" and Web Share chips to the `/chat/[joinRequestId]` inline action row so hosts can blast event invitations without reopening the info sheet, complete with clipboard/share state, success toasts, and graceful fallbacks when the browser lacks Web Share support.
- Threaded reusable invite-share helpers into `ChatConversation` (link resolver, share text builder, clipboard util) so the new chips stay hydrated with the correct Tonight origin even inside the standalone chat view.
- Tests: `cd tonight-web && npx vitest run tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: hook the `/events/[id]` experience with richer chat entry points (CTA + inline preview) so guests can jump into their thread straight from the event page.

## 2026-02-16 21:03 EET — Event page now shows live guest chat preview
- Extended the `/events/[id]` loader to fetch the three latest messages for accepted guests, threading author metadata into the chat preview contract so the event screen always knows what’s happening in their DM thread.
- Updated `EventInsideExperience` with a "Latest in chat" rail that displays those snippets (oldest → newest) plus relative timestamps, giving confirmed guests context before they hit the "Open chat" CTA.
- Added coverage to `tests/components/EventInsideExperience.test.tsx` for the new preview and reran the suite (`cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`).
- Next: surface the same chat preview affordance for hosts (e.g., top unread snippets) so they can jump into `/chat` from the event screen with equal context.

## 2026-02-16 21:24 EET — Host chat preview parity
- Highlighted the host's top unread guest threads directly inside the Event chat card, mirroring the guest-facing preview with inline snippets, timestamps, unread badges, and deep links into `/chat/[joinRequestId]`.
- Reused the existing host unread state so the preview and the Guests needing replies toolbox stay in sync, and tightened the component spec to cover the new block without breaking the host actions suite.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`.
- Next: when hosts are fully caught up, fall back to the latest guest activity (even if read) so the preview still shows context instead of disappearing entirely.


## 2026-02-16 21:48 EET — Host chat preview keeps context when caught up
- Added a fallback builder on the `/events/[id]` loader that grabs the latest guest messages per thread whenever the host has zero unread conversations, threading the snapshots through the chat preview contract.
- Updated `EventInsideExperience` so the "Latest guest pings" module now swaps to a "Recent guest activity" state with the same timestamps/links, ensuring the rail never disappears for caught-up hosts while keeping the actionable "Guests needing replies" list gated to real unreads.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`.
- Next: promote the unread/recent chat summary into the event hero CTA (badge + chip) so hosts and guests see the chat state the moment they land on `/events/[id]`.

## 2026-02-16 22:10 EET — Hero chat CTA surfaces live status
- Threaded the chat preview into the event hero so hosts/guests immediately see the latest snippet, unread badge, and participant/time chips before scrolling, plus mirrored the CTA/disabled states up top.
- Added a hero-specific CTA layout that respects join-request/public flows and exercised the new badge/chip behavior with dedicated component tests.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx`
- Next: extend the Event layout’s sticky mobile action bar with the same unread badge + CTA so chat state follows you while scrolling the event detail.

## 2026-02-16 22:42 EET — Mobile action bar mirrors the chat CTA
- Added a chat-action builder in `/events/[id]/page.tsx` that derives the right label, helper text, and badge tone/count for hosts, accepted guests, pending viewers, and anonymous visitors.
- Threaded the derived action into `EventLayout` → `MobileActionBar`, expanded the bar with a new “Event chat” panel that surfaces the unread badge plus helper copy, and polished the CTA accessibility states.
- Extended the MobileActionBar test suite (self shim + new assertions) and reran `cd tonight-web && npx vitest run tests/components/MobileActionBar.test.tsx` to keep the mobile nav covered.
- Next: listen for chat socket events on the event page and auto-refresh the hero/action-bar badge + helper text when new messages arrive, so the mobile CTA stays live without a reload.

## 2026-02-16 23:29 EET — Event chat CTA stays live via sockets
- Added a client wrapper for the event page layout so the sticky mobile action bar now rebuilds its chat CTA whenever the event experience emits a refreshed preview.
- Threaded host chat participant metadata through the loader and taught `EventInsideExperience` to join every relevant chat room (hosts + guests), updating the hero badge, unread summaries, and host reply rail the moment socket payloads arrive.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/MobileActionBar.test.tsx`.
- Next: surface an explicit “New chat ping” indicator + gentle pulse on the hero/action-bar CTA so hosts/guests get a visual nudge the instant a socket update lands.

## 2026-02-16 23:52 EET — Chat CTA pulses on live pings
- Threaded a new chat-attention channel through `EventInsideExperience` → `EventInsidePageClient` so realtime socket payloads can flag when a fresh guest/host message lands, with a shared timer + clear helpers.
- Restyled the event hero CTA and mobile action bar chat block to show a “New chat ping” chip plus a gentle glow/pulse when attention is requested, and wired the CTA interactions to acknowledge/clear the signal.
- Extended the mobile action bar + builder + tests to support the new attention metadata, and refreshed the EventInsideExperience + MobileActionBar Vitest suites (`cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/MobileActionBar.test.tsx`).
- Next: bubble the same attention signal into the scrolling event layout (e.g., sticky desktop header and in-page toast) so hosts/guests notice new chat pings even after they scroll past the hero block.

## 2026-02-17 00:12 EET — Desktop header + floating toast mirror chat attention
- Plumbed the chat-action payload into `EventLayout` so the sticky desktop header now renders the chat CTA with unread badges + the “New chat ping” pulse, making the signal visible even after the hero scrolls off-screen.
- Added a reusable `EventChatAttentionToast` component and wired it into the event layout to surface a floating, dismissible “Jump back into chat” banner whenever live attention is active, ensuring both hosts and guests get nudged mid-scroll; clicking or dismissing clears the socket-driven attention state.
- Introduced focused coverage for the new UI (`npx vitest run tests/components/DesktopHeader.test.tsx tests/components/EventChatAttentionToast.test.tsx`).
- Next: enrich the floating toast with the latest message snippet + sender context so the alert tells people *what* changed before they jump into `/chat`.

## 2026-02-17 00:26 EET — Floating toast shows live message context
- Threaded `lastMessageAuthorName` metadata through the event loader + realtime chat preview so we always know who authored the latest ping when attention fires.
- Updated the mobile chat action + floating toast wiring so attention alerts now display the sender name, relative timestamp, and a clamped snippet of the newest message, giving hosts/guests immediate context before opening `/chat`.
- Tests: `cd tonight-web && npx vitest run tests/components/EventChatAttentionToast.test.tsx tests/components/EventInsideExperience.test.tsx`
- Next: queue multiple attention pings (and cycle through their snippets) so the floating toast can surface every fresh guest thread instead of only the last one.


## 2026-02-17 01:05 EET — Attention toast rotates through queued chat pings
- Introduced structured `EventChatAttentionPayload`s from `EventInsideExperience` so every realtime socket ping ships its snippet, author, timestamp, and CTA target, then taught the chat attention handler to build a timed queue instead of overwriting the last alert.
- Passed the queue into `EventLayout`/`EventChatAttentionToast`, added a rotating presenter that cycles through each queued snippet (with helper copy, sender, timestamp, and per-item CTA href), and updated the toast specs to cover the new behavior + timer handling.
- Extended `EventInsidePageClient` to keep the queue alive, extend the attention timeout based on queue size, and clear everything when the user interacts so mobile/desktop CTAs stay in sync.
- Tests: `cd tonight-web && npx vitest run tests/components/EventChatAttentionToast.test.tsx tests/components/EventInsideExperience.test.tsx`
- Next: propagate the queued attention payload into the hero/mobile chat CTA badges so the inline chips show which thread pinged (and how many are waiting) even if the toast is dismissed.

## 2026-02-17 01:27 EET — Hero + mobile chat CTAs show queued ping details
- Threaded the realtime attention queue through `EventInsideExperience`, the event hero, desktop header, and the mobile action bar so the same chips that power the floating toast now list who pinged and how many guests are still waiting, complete with pulse states that reuse the queue metadata even if the toast isn’t visible.
- Added a shared label builder, pushed the queue context into `buildMobileChatAction`, and surfaced new badge chips (lead guest + “more waiting”) across hero, desktop, and mobile CTAs; tests cover the new UI rails plus the hero chip rendering.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/MobileActionBar.test.tsx tests/components/DesktopHeader.test.tsx`
- Next: make the lead attention chip actionable (tapping the chip jumps straight into that guest’s `/chat/[joinRequestId]` and exposes a quick picker when multiple guests are queued) so hosts can respond to the right thread without opening the toast carousel.

## 2026-02-17 01:52 EET — Chat attention chips now actionable
- Converted the hero chat attention badge into a live link that jumps straight into the queued guest thread (with proper aria labels + attention clearing) and restyled the waiting badge as a toggle button.
- Added a compact “Queued guests” picker that expands inline, lists every live attention payload with timestamps/snippets, and lets hosts jump directly into any `/chat/[joinRequestId]` without waiting for the toast carousel.
- Updated the EventInsideExperience test suite to cover the new link + picker behavior (`npx vitest run tests/components/EventInsideExperience.test.tsx`).
- Next: Port the clickable attention chips + picker affordance into the desktop header/mobile action bar so every surface shares the same quick-jump controls.

## 2026-02-17 02:26 EET — Desktop + mobile chat CTAs inherit the queue picker
- Ported the new chat-attention chip/link treatment into the sticky desktop header and bottom mobile action bar so hosts see the exact guest who pinged (and how many are waiting) even after the hero scrolls away.
- Added shared relative-time + label helpers, wired the lead chip to deep-link directly into the queued thread, and brought over the toggleable picker so both surfaces can cycle through queued guests without reopening the hero rail.
- Bolstered the DesktopHeader/MobileActionBar specs to cover the new chips + drawer while keeping the targeted Vitest suites green.
- Tests: `cd tonight-web && npx vitest run tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx`.
- Next: let the floating chat attention toast expose the same quick-jump picker (chip actions + queue list) so users can jump threads even if the header/action bar is off-screen.

## 2026-02-17 02:45 EET — Floating toast inherits quick-jump picker
- Ported the chat-attention chips into `EventChatAttentionToast`, so the floating banner now shows the lead guest chip, waiting-count toggle, and a full queued-guest picker with snippets + timestamps.
- Wired the picker interactions to the shared ack handler so clicking any chip/list entry both jumps into the right `/chat/[joinRequestId]` thread and clears the toast attention state, keeping the queue in sync with the hero/header/mobile CTAs.
- Added a focused Vitest run covering the toast picker + chip behavior (`cd tonight-web && npx vitest run tests/components/EventChatAttentionToast.test.tsx`).
- Next: let the toast queue include inline "Mark handled" affordances (per guest) so hosts can clear attention pings without navigating away when they've already answered elsewhere.

## 2026-02-17 03:05 EET — Toast queue gains "Mark handled" controls
- Added per-entry "Mark handled" buttons to the floating chat attention toast (active snippet + queue list) so hosts can clear individual pings without jumping into /chat.
- Threaded a new handler through EventInsidePageClient → EventLayout → EventChatAttentionToast to drop handled payloads from the live queue and keep the attention timer + chips in sync.
- Tests: `cd tonight-web && npx vitest run tests/components/EventChatAttentionToast.test.tsx`.
- Next: propagate the mark-handled affordance to the hero/desktop/mobile chat attention chips so hosts can triage queued guests no matter where they are on the event page.

## 2026-02-17 03:34 EET — Attention chips can clear threads anywhere
- Threaded the chat-attention handler through EventInsideExperience, DesktopHeader, and MobileActionBar so every surface now shares the same queue controls.
- Added "Mark handled" buttons to the hero chips and quick picker plus mirrored the affordance in the desktop header + mobile action bar lists, ensuring hosts can clear queued guests without opening /chat.
- Extended the EventLayout + page client plumbing and refreshed the EventInsideExperience/DesktopHeader/MobileActionBar test suites to cover the new controls.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx`.
- Next: add a bulk "Mark all handled" control that clears every queued chat attention entry at once (with confirm + toast) so hosts can dismiss stale pings quickly.

## 2026-02-17 04:07 EET — Bulk clear for chat attention queues
- Added a shared `handleChatAttentionClearAll` pathway inside `EventInsidePageClient` that confirms before clearing, drops every queued payload, and shows a success toast summarizing how many alerts were dismissed.
- Threaded the bulk control through EventInsideExperience, DesktopHeader, MobileActionBar, and EventChatAttentionToast so every surface (hero chips, desktop header, mobile bar, floating toast) exposes the new "Mark all handled" action without duplicating state.
- Updated the chat attention picker + chip UIs to close automatically when the bulk action fires and refreshed the component test suites to assert the new buttons + callbacks, along with the top-level layout/client plumbing.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/components/EventChatAttentionToast.test.tsx`.
- Next: add a "Snooze chat pings" affordance that mutes the attention pulse for ~5 minutes (with reminder copy + toast) so hosts can pause alerts without clearing the queue when they're mid-conversation elsewhere.
## 2026-02-17 04:42 EET — Chat attention snooze controls
- Added a five-minute snooze pathway for chat attention alerts that pauses the hero/desktop/mobile/float toast pulses, resumes automatically when the timer elapses, and lets people unsnooze early with contextual copy.
- Surfaced Snooze/Resume affordances across EventInsideExperience, DesktopHeader, MobileActionBar, and the floating toast so every surface can pause pings without clearing the queue; updated EventInsidePageClient to manage the timer + resume toast + queue sync.
- Extended the component test suites covering the new controls plus reran `npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/components/EventChatAttentionToast.test.tsx` to lock behavior.
- Next: persist the snooze window across reloads (localStorage + data attribute) so hosts don’t immediately get re-pinged if they refresh or navigate while snoozed.

## 2026-02-17 05:06 EET — Snooze state survives reloads
- Hydrated the chat-attention snooze window from `localStorage`, gated persistence behind a hydration flag so we never clobber stored timestamps on first paint, and mirrored the active window into a `data-chat-attention-snoozed-until` attribute for layout consumers.
- Synced the persisted ISO back into the shared EventLayout + hero/header/mobile chips so snoozed hosts stay quiet across refreshes, plus added a focused DOM test suite (`tests/app/events/EventInsidePageClient.test.tsx`) to cover storage + attribute behavior.
- Tests: `cd tonight-web && npx vitest run tests/app/events/EventInsidePageClient.test.tsx`.
- Next: surface a visible snooze countdown badge (hero/header/mobile/toast) so hosts know exactly when alerts will resume and can unsnooze early from any surface.


## 2026-02-17 05:24 EET — Snooze countdown badges everywhere
- Added a reusable `useSnoozeCountdown` hook and threaded it through EventInsideExperience, the desktop header, mobile action bar, and the floating toast so every surface now shows a live “Snoozed · mm:ss left” badge with a resume control.
- Kept the chat toast visible while snoozed, propagated the countdown into Desktop/Mobile/Toast UIs, and updated the Event layout plumbing so snoozed queues can still surface mark-all/mark-handled actions.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/components/EventChatAttentionToast.test.tsx tests/app/events/EventInsidePageClient.test.tsx`.
- Next: remember the last snooze duration per host (and surface that selection in the pills) so repeat snoozes default to their preferred window without extra taps.
## 2026-02-17 05:45 EET — Snooze duration picker everywhere
- Added shared chat snooze duration options (5/10/20 min) so the hero chips, desktop header, mobile action bar, and floating toast all show the same quick-select pills, keeping the UX consistent across surfaces.
- Updated the EventInsidePageClient to accept variable snooze durations, persist the right timestamps, and emit duration-specific toast copy so hosts know exactly when alerts will resume.
- Refreshed the component + client test suites (EventInsideExperience/DesktopHeader/MobileActionBar/EventChatAttentionToast + EventInsidePageClient) to cover the new handlers and ensure each surface passes the selected duration downstream.
- Next: let hosts pick the snooze duration (e.g., 5/10/20 minutes) from any surface so they can pause alerts for longer focus blocks without hitting snooze repeatedly.


## 2026-02-17 06:10 EET — Snooze preference remembered everywhere
- Tracked each host's preferred chat snooze duration (localStorage + layout wiring) so the last-picked window now hydrates automatically after reloads and flows through `EventInsideExperience`, Desktop header, Mobile bar, and the floating toast.
- Highlighted the preferred pill on every snooze surface (hero chips, desktop header, mobile bar, toast) with selection styling + `aria-pressed`, keeping accessibility intact while making the go-to option obvious at a glance.
- Threaded the preference through `EventInsidePageClient` (new storage key, prop plumbing, tests) and refreshed the whole chat-attention test matrix to cover hydration + highlighting.
- Tests: `cd tonight-web && npx vitest run tests/app/events/EventInsidePageClient.test.tsx tests/components/EventInsideExperience.test.tsx tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/components/EventChatAttentionToast.test.tsx`
- Next: add a one-tap "Snooze for X min" shortcut (using the saved preference) on each surface so hosts can pause alerts with a single press instead of reselecting a pill every time.

## 2026-02-17 06:27 EET — Quick snooze shortcuts everywhere
- Added a dedicated "Snooze for X min" button to the event hero, desktop header, mobile action bar, and floating toast so hosts can pause chat pings with a single tap that honors their saved duration (falls back to 5 min until a preference exists).
- Updated all surfaces to share the same aria copy/countdown wiring, tweaked the tests to cover the new control set, and kept the existing duration pills for people who want to switch windows manually.
- Tests: `cd tonight-web && npx vitest run tests/components/EventInsideExperience.test.tsx tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/components/EventChatAttentionToast.test.tsx tests/app/events/EventInsidePageClient.test.tsx`
- Next: bring the same quick-snooze/resume affordance into the standalone `/chat/[joinRequestId]` header so hosts can pause alerts without jumping back to the event page.

## 2026-02-17 06:47 EET — Chat header inherits snooze/resume controls
- Broke out the chat-attention storage keys into `lib/chatAttentionStorage` so both the event layout and standalone chat view can hydrate/update the same snooze + preference data without cross-importing page code.
- Threaded the `/chat/[joinRequestId]` header with the same quick-snooze button, duration pills, countdown badge, and resume affordance the event page already exposes, including persistence to localStorage + the root data attribute and the wake timer so snoozes auto-expire.
- Tests: `cd tonight-web && npx vitest run tests/app/events/EventInsidePageClient.test.tsx tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`
- Next: surface the queued chat-attention entries inside the chat header (lead guest chip + waiting count + mark-handled controls) so hosts can jump between alerting threads without leaving the DM screen.

## 2026-02-17 07:24 EET — Chat header inherits attention queue
- Persisted the live chat-attention queue into `localStorage` from the event page client and added a storage subscription so every surface stays in sync when hosts triage alerts elsewhere.
- Introduced `chatAttentionQueueStorage` helpers plus Vitest coverage, then wired `/chat/[joinRequestId]` to hydrate the queue, show the lead guest chip + waiting-count badge, expose the quick picker, and offer per-entry/mark-all handled controls directly inside the chat header.
- Synced the chat header’s snooze state with the event layout so snooze timers, preferences, and queue updates remain bidirectional between the event and chat experiences.
- Tests: `cd tonight-web && npx vitest run tests/lib/chatAttentionQueueStorage.test.ts tests/app/events/EventInsidePageClient.test.tsx`
- Next: port the floating chat-attention toast (queue carousel + mark-handled controls) into `/chat/[joinRequestId]` so hosts get the same multi-thread triage without jumping back to the event page.
## 2026-02-17 07:50 EET — Chat attention toast lands inside /chat
- Threaded the shared EventChatAttentionToast into the dedicated chat conversation so hosts now see the same rotating queue, snooze/resume controls, and mark-handled affordances without leaving their DM view; the toast hydrates from the persisted queue, honors dismissals per session, and deep-links directly into queued guest threads.
- Updated ChatConversation to derive helper copy/snippets from the queue, reuse the existing snooze storage + picker state, and gate the toast behind the same host-only checks so the UX stays consistent with the event layout.
- Tests: `cd tonight-web && npx vitest run tests/components/EventChatAttentionToast.test.tsx tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: bubble the chat-attention queue into the /messages inbox list (badges + mark-handled affordances) so hosts can triage waiting guests straight from the thread overview.



## 2026-02-17 08:10 EET — Inbox highlights queued chat attention
- Hydrated the chat-attention queue inside `/messages`, adding a dedicated “Guests needing replies” rail + badges so the host inbox instantly shows who’s waiting (with deep links + mark-handled controls).
- Threaded the queue metadata into `ConversationList`, overlaying inline warnings + a clear badge/snippet on every conversation that still needs a reply, and backfilled a focused React Testing Library suite to cover the new behaviors.
- Wired the inbox actions back to the shared storage helpers so clearing or acknowledging a guest from `/messages` keeps the event + chat views in sync.
- Tests: `cd tonight-web && npx vitest run tests/components/ConversationList.test.tsx`
- Next: expose the chat-attention snooze/resume controls inside `/messages` (mirror the event/chat headers) so hosts can pause or resume alerts without leaving the inbox.

## 2026-02-17 08:34 EET — Messages inbox picks up chat snooze controls
- Hydrated the `/messages` client with the same chat-attention snooze state + preference plumbing as the event/chat surfaces (localStorage, `data-chat-attention-snoozed-until`, timers, and shared toast copy) so the inbox stays in sync when hosts pause alerts elsewhere.
- Added quick snooze/resume controls to the `MessagesAttentionSummary` card, complete with countdown badges, duration pills, and storage-backed defaults, ensuring hosts can pause or resume chat pings without leaving the inbox.
- Backed the new behavior with a focused Vitest suite that covers the snooze UI states for the summary card.
- Tests: `cd tonight-web && npx vitest run tests/app/messages/messages-attention-summary.test.tsx`
- Next: surface the active snooze countdown + resume shortcut inside the Messages desktop header/mobile bar so hosts can manage alerts even when the attention card is off-screen.

## 2026-02-17 08:55 EET — Messages header + mobile bar mirror snooze state
- Threaded the inbox chat-attention queue and snooze metadata into the Messages desktop header so the sticky top bar now shows the live countdown badge, resume shortcut, quick-snooze options, and mark-handled controls even after you scroll past the attention card.
- Passed the same queue/snooze handlers into the MobileActionBar so the bottom nav exposes the active timer + resume button, keeping mobile hosts in sync when they hide the Guests needing replies section.
- Tests: `cd tonight-web && npx vitest run tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/app/messages/messages-attention-summary.test.tsx`
- Next: bubble the chat-attention queue count into the Messages filter chips so hosts can jump straight to whichever status still has guests waiting.

## 2026-02-17 09:05 EET — Filter chips highlight queued chat attention
- Exported a helper that maps the active chat-attention queue to the Messages filter set and surfaced the per-status counts directly inside each chip, including accessibility labels + alert badges so hosts can see where guests are waiting before switching filters.
- Updated the Messages UI to show a warning pill with the number of queued guests per filter, ensuring the “All/Accepted/Pending” chips advertise live attention data while keeping the existing totals intact.
- Added a focused Vitest suite for the new helper (`tests/app/messages/messages-filter-attention.test.ts`) and reran the Messages attention summary specs to keep the snooze rail coverage intact.
- Tests: `cd tonight-web && npx vitest run tests/app/messages/messages-filter-attention.test.ts tests/app/messages/messages-attention-summary.test.tsx`
- Next: add a one-tap “Jump to waiting guests” action near the filter chips that auto-selects the chip with queued pings and scrolls the list to the first attention thread.

## 2026-02-17 09:32 EET — Messages jump CTA locks onto waiting guests
- Added a storage-aware helper + UI plumbing so /messages now surfaces a “Jump to waiting guests” control beside the filter chips; it auto-selects the correct status filter, scrolls to the first queued conversation, and temporarily highlights the card for quick triage.
- Introduced a scroll-target ref + visual cue for the ConversationList along with data attributes to anchor the animation, keeping the experience smooth on both desktop and mobile.
- Expanded the messages filter unit tests to cover the new helper logic and reran the ConversationList suite to keep the attention badges + markup changes covered.
- Tests: `cd tonight-web && npx vitest run tests/app/messages/messages-filter-attention.test.ts tests/components/ConversationList.test.tsx`
- Next: mirror the “Jump to waiting guests” affordance inside the Messages mobile action bar so phone users can warp to the queued chat without scrolling.


## 2026-02-17 09:44 EET — Messages mobile bar jump CTA
- Added a `canJumpToWaitingGuests` pathway to the shared `MobileActionBar`, surfacing a dedicated Guests needing replies panel with a one-tap jump button when the inbox has queued attention.
- Threaded the new props through `/messages/page.tsx` so the mobile action bar now launches the existing jump-to-waiting flow, ensuring mobile hosts can warp straight to the first guest needing a reply.
- Expanded `tests/components/MobileActionBar.test.tsx` to cover the new control and re-ran the suite (`npx vitest run tests/components/MobileActionBar.test.tsx`).
- Next: enrich the MobileActionBar jump CTA with the queued guest count + quick picker so hosts can open a specific waiting thread without scrolling first.

## 2026-02-17 10:22 EET — Mobile jump CTA gains queue picker + counts
- Upgraded the MobileActionBar Guests needing replies block with a live queued count badge, inline quick picker chips (up to three guests), and a drawer that lists every waiting thread with snippets, timestamps, and mark-handled buttons.
- Synced the quick picker interactions with the existing chat attention queue so tapping a chip, marking handled, or clearing all entries closes both pickers and keeps the jump CTA + helper copy in sync.
- Tests: `cd tonight-web && npx vitest run tests/components/MobileActionBar.test.tsx`.
- Next: bring the same queue-count + quick picker treatment to the Messages desktop header CTA so desktop hosts can jump directly into any waiting guest without scrolling.

## 2026-02-17 10:40 EET — Desktop header jump CTA matches mobile quick picker
- Extended `DesktopHeader` with the same Guests needing replies CTA from mobile: desktop hosts now see the queued count, a jump button, inline quick picker chips, and a drawer listing every waiting guest (with mark-handled + bulk clear actions).
- Updated `/messages/page.tsx` to pass the new jump props through every DesktopHeader instance so the CTA stays wired during loading/error states, and added Vitest coverage for the expanded UI (`npx vitest run tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx`).
- Next: persist per-thread draft replies on `/chat/[joinRequestId]` so bouncing between queued guests via the new pickers never drops an in-progress message.


## 2026-02-17 11:12 EET — Chat drafts persist per thread
- Added a `chatDraftStorage` helper that stores per-join-request composer text in localStorage with pruning so hopping between chats never drops in-progress replies.
- Hydrated the `/chat/[joinRequestId]` composer from the new storage, auto-saved changes after hydration, and cleared entries once messages send or drafts empty out.
- Covered the storage helper with a dedicated Vitest suite and reran the chat properties + socket suites to ensure regressions stay caught (`npx vitest run tests/lib/chatDraftStorage.test.ts tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`).
- Next: surface the saved-draft indicator + manual clear affordance in the chat composer so hosts know when a message is staged before jumping threads.

## 2026-02-17 11:24 EET — Chat composer surfaces saved drafts
- Added a composer-level draft indicator that lights up whenever a stored message is present, so hosts/guests immediately know they have text staged before hopping threads.
- Introduced a clear-draft control that wipes the textarea, purges localStorage, refocuses the composer, and toasts confirmation so people can reset with one tap.
- Tests: `cd tonight-web && npx vitest run tests/lib/chatDraftStorage.test.ts tests/properties/chat-messages.test.ts tests/hooks/useSocket.test.tsx`.
- Next: bubble the saved-draft state into the /messages conversation list (badges + clear affordance) so you can spot and manage drafts without opening each chat.

## 2026-02-17 11:52 EET — Messages list now highlights saved drafts
- Added a chat-draft storage pub/sub channel and subscription helper so the inbox can react instantly whenever a composer draft is saved or cleared, even across tabs.
- Upgraded ConversationList with opt-in draft indicators: badges in the header, a detailed draft card with timestamp + snippet, and an inline clear control wired to both local state and storage, so hosts can triage drafts without opening each chat.
- Passed the new indicators through /messages, plus expanded the Vitest suite (storage + ConversationList) to lock the behavior and prevent regressions.
- Tests: `cd tonight-web && npx vitest run tests/lib/chatDraftStorage.test.ts tests/components/ConversationList.test.tsx`
- Next: extend the Guests needing replies rail with a "Drafts waiting" chip so hosts can jump straight to threads that have unsent replies queued up.

## 2026-02-17 12:15 EET — Guests needing replies rail spots saved drafts
- Hydrated the /messages page with chat-draft storage, tracked which conversations have unsent replies, and taught the Guests needing replies rail to surface a new "Drafts waiting" chip that jumps straight to the freshest draft thread.
- Hooked the jump action into the existing scroll/highlight helper so draft chats come into view in the inbox, and added React Testing Library coverage for the new chip behavior.
- Tests: `cd tonight-web && npx vitest run tests/app/messages/messages-attention-summary.test.tsx`
- Next: mirror the Drafts waiting shortcut in the Messages desktop header + mobile action bar so the quick picker stays accessible even after you scroll past the rail.


## 2026-02-17 12:32 EET — Drafts shortcut stays visible
- Mirrored the Messages rail's “Drafts waiting” CTA inside `DesktopHeader`, including a shared button that works even when no chat CTA is present so hosts can always jump back to unsent replies.
- Added the same drafts shortcut block to `MobileActionBar`, styled for the bottom nav, so mobile hosts get the badge + context without scrolling back to the rail.
- Threaded the new props through `messages/page.tsx` and covered them with focused unit tests so both surfaces stay exercised.
- Tests: `cd tonight-web && npx vitest run tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx`.
- Next: extend the Mobile Action Bar drafts block with a tiny quick picker (names + timestamps) so hosts can jump directly into a specific drafted thread without opening the inbox.

## 2026-02-17 12:54 EET — Mobile drafts quick picker lands in action bar
- Extended the Messages draft-tracking helpers so each stored draft now carries the participant name plus a sanitized snippet, and threaded those details into a new `draftQuickPickEntries` payload for the Mobile Action Bar.
- Refined the Mobile Action Bar to accept the new entries, rendering quick-picker chips + an expandable list that deep-link straight into `/chat/[joinRequestId]`, complete with relative timestamps and snippets so hosts can jump to any draft without opening the inbox.
- Added unit coverage for the new quick picker and kept the component suite green (`cd tonight-web && npx vitest run tests/components/MobileActionBar.test.tsx`).
- Next: bring the same drafts quick picker affordance to the Desktop header + inbox attention summary so the parity holds across surfaces.

## 2026-02-17 13:22 EET — Desktop + inbox drafts quick picker parity
- Mirrored the Mobile Action Bar's draft quick picker in `DesktopHeader`, including inline chips, an expandable list with snippets/timestamps, and the same badge counters so desktop hosts can hop straight into any drafted chat without scrolling the inbox.
- Upgraded `MessagesAttentionSummary` with the identical quick picker treatment, wiring the selector to the existing jump handler so the Guests needing replies rail now doubles as a draft hub; refreshed the `/messages` page wiring plus Desktop/Mobile specs to cover the new props.
- Tests: `cd tonight-web && npx vitest run tests/components/DesktopHeader.test.tsx tests/components/MobileActionBar.test.tsx tests/app/messages/messages-attention-summary.test.tsx`.
- Next: add inline “Clear draft” controls to each quick-picker entry so hosts can drop stale drafts directly from the header/attention summary without opening the conversation.

## 2026-02-17 13:45 EET — Draft quick pick entries can clear in place
- Added a shared `handleClearDraft` flow that wipes localStorage, trims the in-memory draft map, and surfaces a toast so clearing a saved reply doesn't require opening the conversation.
- Threaded the handler through `DesktopHeader` + `MessagesAttentionSummary`, giving every quick-picker chip/list entry a nearby “Clear draft” control (matching hover/focus states) so hosts can drop stale replies right from the header or Guests needing replies rail.
- Updated the Vitest suites covering both components to assert the new buttons + callbacks (`cd tonight-web && npx vitest run tests/components/DesktopHeader.test.tsx tests/app/messages/messages-attention-summary.test.tsx`).
- Next: mirror the inline clear-draft controls inside the Mobile Action Bar quick picker so mobile hosts get the same management affordance.
