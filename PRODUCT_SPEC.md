# 300 Before 30 — V1 Product & Build Specification

## Product principle
**Feature-light, design-rich.** A beautiful, customisable checklist. The curated 300 are the starting point, not a mandate: users can add, edit or delete items and their denominator changes automatically.

## V1 navigation
Permanent bottom navigation: **Home · My List · Me**.

### Home
Only:
1. Editorial hero / brand.
2. Overall progress: percentage + `X of Y completed`.
3. Six category progress cards; tapping a card opens My List filtered to that category.
No feed, recommendations, memories, planner, dates, streaks or AI.

### My List
- `X of Y · Z% complete`.
- Search.
- Category filters.
- Status filters: All / To Do / Done.
- Cards / List toggle.
- Large tappable completion controls.
- Add goal button.
- Standard goal opens a compact sheet with complete/edit/delete.
- Counter goal opens numeric +/- and editable number.
- Checklist goal opens its sub-items.

### Me
- Username only.
- Overall progress.
- Export list.
- Reset to original starter 300.
- Sign out/switch profile.
- Delete account/profile.

## Categories
1. Once in a Lifetime
2. Trips & Travel
3. Short Trips & Days Out
4. Activities, Events & Nights Out
5. Everyday / Easy Wins
6. Life Milestones

## Goal types
### Standard
Boolean complete/not complete.
### Counter
`current / target`; complete automatically when current >= target.
Starter counter goals:
- Watch the top 100 rom-coms — 100
- Read 50 classic novels — 50
- Watch 50 classic movies — 50
- Visit 50 countries — 50
- Visit 10 US states — 10
### Checklist
Complete automatically when all children are complete.
Starter checklist goals:
- Seven Wonders of the Modern World
- Seven Continents

## Multi-user model
### Critical rule
The master list is immutable. Creating a profile copies all 300 starter records into that user's own list. Every edit afterwards affects only that user's rows.

### Username
- User chooses a unique username.
- Store a normalised lowercase `username_key` for uniqueness while preserving display casing separately.
- Usernames contain letters, numbers and underscores; suggested length 3–20.
- Username is not inherently private and must **not** be treated as authentication by itself.

## Recommended account model — no PII
For production, use **Supabase anonymous authentication**. It creates a unique authenticated user without email, phone number or password. A profile row then stores only the chosen username.

Important limitation: an anonymous Supabase account cannot be recovered after sign-out, cleared browser/app data, or moving to another device unless it is linked to another identity. Therefore V1 can offer either:
- **Device-only profile (default):** username + anonymous auth, no personal information. Make “sign out” wording very clear because recovery is unavailable; or
- **Optional recovery later:** user chooses to link Apple/email/passkey only if they want cross-device recovery. This is not required to use the app.

Do **not** implement global username-only login: anyone who knows another person's username could impersonate them.

## Data model
### `master_experiences`
- id uuid primary key
- position integer
- title text
- category enum/text
- goal_type (`standard`, `counter`, `checklist`)
- target integer nullable
- is_active boolean

### `master_subgoals`
- id uuid
- master_experience_id uuid
- position integer
- title text

### `profiles`
- id uuid = auth user id
- username text
- username_key text unique
- created_at timestamptz

### `user_experiences`
- id uuid
- user_id uuid
- master_experience_id uuid nullable
- sort_order numeric
- title text
- category text
- goal_type text
- target integer nullable
- current_value integer default 0
- completed boolean default false
- created_at timestamptz

### `user_subgoals`
- id uuid
- user_experience_id uuid
- user_id uuid
- sort_order integer
- title text
- completed boolean

## Creation flow
1. App anonymously authenticates user.
2. User selects username.
3. Database atomically checks username uniqueness.
4. Create profile.
5. Copy active master experiences into `user_experiences`.
6. Copy checklist children into `user_subgoals`.
7. Open Home.

## Security
- Enable Row Level Security on all user-owned tables.
- A user can select/update/delete only rows where `user_id = auth.uid()`.
- Master experiences are read-only to app users.
- Username availability can be checked through a controlled RPC/function rather than exposing all profiles.
- Never use the public/anonymous API role as ownership. Anonymous **Auth users** still have unique authenticated user IDs.

## Progress calculations
`completed goals / total current goals × 100`, rounded to nearest whole percent for UI.
Deleting or adding goals changes the denominator immediately.
Counter/checklist parent completion is derived from progress, not manually independent.

## Editing rules
- Edit changes the user's copy only.
- Delete removes only the user's copy.
- Add creates a user-only standard goal by default.
- No replacement idea library and no AI.
- Optional future “restore original” can use `master_experience_id`; not required for core V1.

## Visual system
Main direction: **editorial first, subtle travel ephemera second**.
- Warm paper/ivory background.
- Near-black ink typography.
- Deep muted green primary UI colour.
- Editorial serif for display/headlines, clean sans serif for controls.
- Card variety: photography hero, typographic, illustration, editorial split, event/ticket, minimal milestone.
- Do not make every card a literal stock photo.
- Custom line iconography for categories in production; emoji are working placeholders only.
- Lots of whitespace and oversized numbers.

## Prototype status
This folder contains a browser prototype using localStorage. It simulates multiple users on one device by storing independent lists under unique local usernames. It intentionally does **not** pretend this is secure cross-device authentication. The production migration is to Supabase anonymous auth + RLS using the schema in `supabase-schema.sql`.
