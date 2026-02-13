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
