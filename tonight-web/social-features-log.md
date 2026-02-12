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
