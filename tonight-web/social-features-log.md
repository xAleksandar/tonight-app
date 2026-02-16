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
