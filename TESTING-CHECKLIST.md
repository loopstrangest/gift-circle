# Gift Circle - Testing Checklist

This document outlines all the changes made in the recent update and what to test.

## Work Stream 1: Two-Word Room Codes

### Changes
- Room codes now use two-word format (e.g., "vow-empowerment") instead of 6-character alphanumeric
- Validation and normalization functions added
- Word list at `src/room-code-words.txt`

### What to Test
- [ ] Create a new room and verify the code is two words separated by a hyphen
- [ ] Join a room using the two-word code
- [ ] Try joining with mixed case (should normalize to lowercase)
- [ ] Try invalid codes (single word, numbers, special characters) - should reject
- [ ] Verify room code displays correctly in the UI
- [ ] Test "Copy room code" button works

---

## Work Stream 2: Overview Page Improvements

### Changes
- Removed truncation from offer/desire titles
- Sort label changed from "Author" to "Participant"
- Removed joined time display from member list
- Member count only shows for host
- Renamed sections to "My Added Offers/Desires"
- Removed "X active entries" metadata
- Default sort is now "Participant" (by author)
- Participant names are clickable to filter offers/desires
- Offers and Desires separated into tabs
- Confirmed commitments (FULFILLED status) hidden in DECISIONS/SUMMARY rounds

### What to Test
- [ ] Long titles display fully without truncation
- [ ] Sort dropdown shows "Participant" option (not "Author")
- [ ] Member list does NOT show join time
- [ ] As host: see "X members" count; as participant: don't see count
- [ ] Sections show "My Added Offers" and "My Added Desires"
- [ ] Click a participant name → filters to only their items
- [ ] Click filtered participant again → clears filter
- [ ] Filter badge appears when filtering, with X to clear
- [ ] Tabs switch between Offers and Desires views
- [ ] Tab counts update correctly
- [ ] In DECISIONS round: FULFILLED items don't appear in lists
- [ ] Mobile: tabs scroll horizontally without breaking layout

---

## Work Stream 3: Connections Page → Requests

### Changes
- Page renamed from "Connections" to "Requests"
- Added tabs for "Open Offers" and "Open Desires"
- Pending request count badges on tabs
- Individual items show pending count badge
- Updated styling to brand colors

### What to Test
- [ ] Header says "Requests" (not "Connections")
- [ ] Navigation link says "Requests"
- [ ] Tabs show "Open Offers (X)" and "Open Desires (X)"
- [ ] Tabs show badge with pending request count when > 0
- [ ] Individual offer/desire cards show pending count badge
- [ ] "Request to Receive" and "Request to Give" buttons work
- [ ] My Activity section shows sent requests
- [ ] Withdraw button works for pending requests
- [ ] Gating message appears when not in CONNECTIONS round

---

## Work Stream 4: Decisions Page Styling

### Changes
- Updated all colors to brand palette
- "My Confirmed Connections" uses green border for Giving, gold for Receiving
- Pending decision count uses gold styling
- All cards use brand-sand borders

### What to Test
- [ ] Giving section has green-tinted background/border
- [ ] Receiving section has gold-tinted background/border
- [ ] Pending count badge is gold-styled
- [ ] Accept/Decline buttons work correctly
- [ ] PDF download button works when commitments exist
- [ ] Download button disabled when no commitments
- [ ] Gating message appears when not in DECISIONS round

---

## Work Stream 5: SUMMARY Round

### Changes
- New SUMMARY round added after DECISIONS
- New Summary page at `/rooms/[code]/summary`
- Shows finalized commitments with count badges
- Enjoyment prompt for sharing experience
- Shows other participants' shared enjoyment
- New API endpoint: POST `/api/rooms/[code]/enjoyment`
- Auto-navigation to Summary when round advances

### What to Test
- [ ] Host can advance from DECISIONS to SUMMARY
- [ ] Navigation shows "Summary" link in SUMMARY round
- [ ] Auto-redirects to Summary page when round changes
- [ ] "My Final Commitments" section shows Giving (green) and Receiving (gold)
- [ ] Count badges show correct numbers
- [ ] Enjoyment textarea appears for users who haven't shared
- [ ] Submit enjoyment → shows "You shared:" with content
- [ ] Other participants' enjoyments appear in "What Others Enjoyed"
- [ ] Enjoyment limited to 2000 characters
- [ ] Gating message appears when not in SUMMARY round

---

## Work Stream 6: Schema Changes

### Changes
- Room model: added `title` (optional), `expiresAt` (DateTime)
- RoomMembership model: added `enjoyment` (optional string)
- RoomRound enum: added SUMMARY

### What to Test
- [ ] New rooms have `expiresAt` set to 48 hours from creation
- [ ] Expired rooms return 410 Gone when accessed (lazy deletion)
- [ ] Enjoyment field saves and retrieves correctly
- [ ] Round progression includes SUMMARY as final round

---

## Full Flow Test

Test a complete Gift Circle session:

1. [ ] Create a new room (verify two-word code)
2. [ ] Copy and share room code
3. [ ] Join as second user
4. [ ] Host advances to OFFERS round
5. [ ] Both users create offers
6. [ ] Host advances to DESIRES round
7. [ ] Both users create desires
8. [ ] Host advances to CONNECTIONS round
9. [ ] Users make requests on each other's items
10. [ ] Host advances to DECISIONS round
11. [ ] Users accept/decline requests
12. [ ] Verify confirmed commitments appear correctly
13. [ ] Download PDF of commitments
14. [ ] Host advances to SUMMARY round
15. [ ] Users share enjoyment
16. [ ] Verify enjoyment appears for other participants

---

## API Endpoints to Verify

- `POST /api/rooms` - Creates room with two-word code
- `POST /api/rooms/[code]/join` - Validates two-word code format
- `POST /api/rooms/[code]/advance` - Can advance to SUMMARY
- `POST /api/rooms/[code]/enjoyment` - Saves enjoyment (SUMMARY round only)
- `GET /api/rooms/[code]/export` - PDF export works

---

## Files Changed

### New Files
- `src/room-code-words.txt` - Word list for room codes
- `src/app/rooms/[code]/summary/page.tsx` - Summary page
- `src/app/api/rooms/[code]/enjoyment/route.ts` - Enjoyment API

### Modified Files
- `prisma/schema.prisma` - Added fields and SUMMARY round
- `prisma/schema.postgres.prisma` - Same changes for production
- `src/lib/room-code.ts` - Two-word code generation
- `src/lib/room-types.ts` - Type updates
- `src/lib/room-round.ts` - SUMMARY round info
- `src/app/page.tsx` - Updated room code input
- `src/app/rooms/[code]/room-shell.tsx` - Navigation updates
- `src/app/rooms/[code]/room-status.tsx` - Overview improvements
- `src/app/rooms/[code]/connections/page.tsx` - Renamed to Requests
- `src/app/rooms/[code]/decisions/page.tsx` - Styling updates
- `src/app/rooms/[code]/offers/page.tsx` - Section rename
- `src/app/rooms/[code]/desires/page.tsx` - Section rename
- Various API routes - Two-word code validation
- Various test files - Updated for new code format
