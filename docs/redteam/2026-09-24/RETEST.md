# Retest of the 2026-09-24 fixes

Run 2026-09-24 against a production build (cb192f0 + 19025cb) and the demo dev server. No paid research was spent. Trip pages opened by the organizer, a guest, and an AI handoff made **0** research requests.

**Result: 84 findings. 78 pass, 5 partial, 1 fail.** The one fail is fixed in 98086de. Of the 09-23 rows, 29 of 31 pass and 2 are partial. There are no logic regressions.

| Result | Findings |
|---|---|
| Fail → fixed | J06: the demo header overflowed a 390 px phone once the Talk button was added. It now measures 390/390. |
| Partial | **J07 tap targets.** Chips, small buttons and votes pass. Designer card links now get 44 px; globe toggles, "Why this trip" and photo credits remain. |
| Partial | **I06 Right now.** It shows no sourced place yet, even with research cached. |
| Partial | **K01 and K05 daily budgets.** They cap correctly but live in memory per instance. A durable ledger needs a migration (HIGH_CAPABILITY), and it blocks a public launch. |
| Partial | **K04.** Unrounded flight dates can mint new paid flight calls, within the $0.40/day/instance pool. |

New issues found during the retest, all fixed in 98086de:
- **N3:** cache pruning evicted the newest place first.
- **N4:** keyboard mash was offered as a place.
- **N5:** the import page said "no profile" after a save and reload.
- **N7:** on a preview, links pointed at production.

N6 (`aria-current` on /account and /agents) is still open and low priority.

The screenshots stay local (39 MB); they are not committed. The HTML report shows the current status per finding. The retest was run by a Claude agent; Astra did not review it.
