# System Design Write-up

## 1. Slot Hold Mechanism

Rather than letting patients book a raw time directly, every bookable interval is
pre-generated as a row in a `slots` table (`doctor_id`, `slot_date`, `start_time`,
`status`). Booking is a two-step flow:

1. **Hold** (`POST /appointments/hold`) — the patient picks a slot; the row is moved from
   `open` to `held`, tagged with `held_by_patient_id` and a `hold_expires_at` timestamp
   (default 5 minutes, configurable via `SLOT_HOLD_MINUTES`). This reserves the slot while
   the patient fills in the symptom form, without finalising a booking.
2. **Confirm** (`POST /appointments/confirm`) — once the symptom form is submitted, the
   server re-checks that the slot is still `held` by *this* patient and that the hold hasn't
   expired, then atomically creates the `appointment` row and flips the slot to `booked`.

If the patient abandons the flow, a cron job (`slotHoldCleanupJob`, every minute) sweeps
expired holds back to `open` so the slot isn't lost to no-shows in the booking flow itself.

## 2. Double-Booking Prevention

Two safeguards work together:

- **Row-level locking.** Both `holdSlot` and `confirmBooking` run inside a Sequelize
  transaction that does `SELECT ... FOR UPDATE` on the target slot row before checking or
  changing its status. If two patients hit "book" on the same slot within milliseconds of
  each other, MySQL serialises the two transactions on that row: the first request holds the
  slot and commits; the second request's `SELECT ... FOR UPDATE` blocks until the first
  transaction finishes, then sees `status = 'held'` and is rejected with a 409 before it can
  touch the row. No two transactions can ever observe the slot as `open` simultaneously.
- **Schema-level uniqueness.** `slots` has a unique key on `(doctor_id, slot_date,
  start_time)`, and `appointments.slot_id` is unique. Even if application logic were
  bypassed, the database itself refuses a second appointment against the same slot or a
  duplicate slot row for the same doctor/date/time.

This turns "prevent double-booking" from an optimistic, retry-after-the-fact problem into a
pessimistic one resolved at the row level, which is simpler to reason about than
compare-and-swap logic scattered across the API layer.

## 3. Doctor Leave Conflict Handling

When an admin marks a doctor on leave for a date (`POST /admin/doctors/:id/leave`):

1. A `doctor_leaves` row is recorded (also consulted by `slotService` so future slot
   generation skips leave dates).
2. Any `open` slots on that date are flipped to `blocked` so patients can no longer book
   them.
3. Any already-`booked` appointments on that date are looked up, cancelled
   (`status = 'cancelled'`, with a reason), and their slots blocked too.
4. For each cancelled appointment: the Google Calendar events for both patient and doctor are
   deleted (best-effort — failure here does not undo the cancellation), and a "leave notice"
   email is queued to the affected patient explaining the doctor is unavailable and inviting
   them to rebook.

This keeps leave-day handling transactional at the business-logic level (find affected
appointments → cancel → clean up side effects) rather than requiring the admin to manually
hunt down and cancel each booking.

## 4. Notification Failure Handling

Every outbound email is first written to a `notifications` table (`status = pending`) *and
then* an immediate send is attempted. Two outcomes:

- **Success** — the row is marked `sent`, done.
- **Failure** (SMTP down, bad credentials, transient network error) — the row is marked
  `failed` with `last_error` and `retry_count` incremented, but the *triggering action never
  fails*. Booking, cancellation, and leave-marking all treat email as a fire-and-forget
  side effect: the appointment is created/cancelled first and committed, and only then is the
  email attempted asynchronously.
- A cron job (`notificationRetryJob`, every 5 minutes) re-attempts every `failed`
  notification whose `retry_count` is below `max_retries` (default 3), using the same
  `attemptSend` logic. This gives transient outages a bounded number of automatic retries
  without a human needing to intervene, while avoiding an infinite retry loop for a
  permanently bad address.

The same "never block the core transaction" principle is applied to the LLM calls
(`llmService`) and Google Calendar (`calendarService`): both are wrapped in try/catch, log
and store a status (`pending`/`success`/`failed`) or return `null`/`false` on failure, and
are always called *after* the database transaction for the appointment itself has already
committed. A down OpenAI API or an unconnected Google Calendar account degrades the
experience (no AI summary, no calendar sync) but never prevents a patient from booking or a
doctor from completing a visit.

---
*Word count: ~780*
