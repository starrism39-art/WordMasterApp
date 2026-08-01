# Phone preview evidence 2026-07-30

- Source: user-provided real-phone screenshot `C:/Users/15189/AppData/Local/Temp/codex-clipboard-55a81c02-28e2-4893-848d-abf4df349054.jpg`.
- Student: `E2E-CROSS-CLIENT-ONLY` (`student_1785337316821`), grade `高一`.
- Current wordbook: `senior_textbook_real` / `高中统编版英语词书`.
- Home stats shown on phone at about 09:30 Asia/Shanghai: learned `21`, unmastered `0`, check-in days `0`.
- Cloud read-only recheck: `learning_records=1` with exactly `20` words and `10/10` classification; `word_mastery=20`; `learning_progress.learnedWords=21` with `legacyLearnedWords=1`.
- Interpretation: the phone-visible learned count follows the cloud progress aggregate (`21`) even though the formal record and mastery detail each contain only `20`. This is a real cross-client-visible consistency issue, not only a WeChat DevTools local-storage artifact.
- WeChat DevTools comparison: home and statistics pages show learned `21` and unmastered `1`; records page shows one learning record with `20` words, mastered `10`, not mastered `10`.
- Anti-forgetting boundary finding at about 09:38 Asia/Shanghai: cloud `nextReviewTime` for the ten difficult words is `2026-07-30 23:19:55.653 +08:00`, but the DevTools review page already exposes round 1 as `canReview=true`. Its local batch has `11` words because the precheck artifact `senior_textbook_real_sell` is mixed into the ten formal difficult words.
- Safety: do not start the phone review before the exact due time. Capture the phone review-list state only.
- Remaining phone checks: statistics page, learning-record page, and anti-forgetting entry/list without starting any learning or review flow.

## Phone detail-page evidence at 18:48-18:49

- Statistics page: learned `21`, unmastered `0`, progress `21 / 4292` (`0.49%`).
- Learning-record page: all `0`, learning `0`, review `0`, current-wordbook record count `0`.
- Anti-forgetting page: five-round plan `0` records and empty-state message.
- CloudBase read-only comparison at the same stage: the dedicated student still has one `learning_records` document containing 20 words and 20 `word_mastery` documents, including 10 anti-forgetting seeds.
- CloudBase collection permissions are `PRIVATE` for `learning_records`, `word_mastery`, and `learning_progress`. A Mini Program client query under the teacher OPENID can read the dedicated student's one learning record and 20 mastery documents, so the current evidence does not support a collection-permission difference as the primary cause.
- Cross-client conclusion: the phone has only the progress aggregate in local storage/page state. The cloud detail collections were not hydrated into phone-local `learningRecords` and `wordMastery`, or hydration completed without notifying/reloading the record and review pages.
- Severity: P1. A second client displays progress growth while hiding the corresponding learning history and anti-forgetting work.

## Phone post-splash-sync evidence at 19:08-19:09

- Sources:
  - `D:/xwechat_files/wxid_iv7i41yq4sgp22_8faf/temp/RWTemp/2026-07/9e20f478899dc29eb19741386f9343c8/4a643fbe531ab9b9ceb81c8e93f06adc.jpg`
  - `D:/xwechat_files/wxid_iv7i41yq4sgp22_8faf/temp/RWTemp/2026-07/9e20f478899dc29eb19741386f9343c8/fdb216e7445cb385ba2966ac82403771.jpg`
  - `D:/xwechat_files/wxid_iv7i41yq4sgp22_8faf/temp/RWTemp/2026-07/9e20f478899dc29eb19741386f9343c8/36d733ad644d4d9c1f545897d37c4c66.jpg`
- The splash/startup sync changed the anti-forgetting page from zero items to a five-round plan, proving that a cloud-to-local hydration attempt ran.
- Each round contains only one word. The "view words" page identifies that survivor as `summer`.
- The learning-record page remains empty: all `0`, learning `0`, review `0`, current-wordbook `0`.
- Round 1 is labeled due at about 19:08 even though the ten difficult words have exact cloud due time `2026-07-30 23:19:55.653 +08:00`. This independently confirms the day-end-versus-exact-time boundary defect.

## Read-only pagination reproduction

- Production sync uses `MAX_QUERY_LIMIT = 100` and advances `offset += 100`.
- In a WeChat Mini Program client query, each requested 100-row page returned only 20 documents.
- Exact production pagination emulation:
  - `learning_records`: total `129`, offsets `0,100`, page lengths `20,20`, fetched `40`, dedicated-student records found `0`.
  - `word_mastery`: total `329`, offsets `0,100,200,300`, page lengths `20,20,20,20`, fetched `80`, dedicated-student mastery documents found `7`.
- Safe 20-row pagination with the same `teacher_id` filter and `_id` ascending order:
  - `learning_records`: fetched `129/129` unique documents and found the dedicated student's one record (`...__record__1785338395652`).
  - `word_mastery`: fetched `329/329` unique documents and found all `20` dedicated-student mastery documents.
- Root cause: the loop advances by the requested 100 rows while the client SDK returns at most 20, so 80-row gaps are skipped after every request. This deterministically explains why aggregate progress (a small collection) syncs while record and mastery detail (large collections) is incomplete.
- The cloud documents are intact and readable from the Mini Program identity; this is a client hydration pagination bug, not cloud data loss.
- The phone's exact one-word survivor was captured before the latest collection total changed. `summer` is one document that happened to fall in a sampled page or remained in local merged state; the current evidence does not prove which of those two paths supplied it.

## Post-fix cross-client verification at 19:55

- Preview source: fixed branch `codex/cross-client-cloud-sync-e2e`, commits `75d83fa` and `87fabfb`.
- Test identity remained the dedicated student `E2E-CROSS-CLIENT-ONLY` (`student_1785337316821`) under the test teacher account.
- The user scanned the newly generated preview QR on a real phone and verbally confirmed that the previously missing data was now present.
- Confirmed outcome: the real-phone client can hydrate the formal learning record and the complete anti-forgetting word set instead of showing an empty learning-record page and only `summer`.
- Screenshot evidence was explicitly waived by the user, so this section records interactive user confirmation rather than a new image artifact.
- The phone check was read-only: no new learning or review flow was started before the exact first-round due time.
- Exact first-round due time remains `2026-07-30 23:19:55.653 +08:00`; the post-due review/test completion is tracked separately.

## Final fixed-build acceptance on 2026-08-01

- Fixed client commit: `5f8f85f` (`fix(sync): keep cross-client learning state consistent`).
- Fixed `syncMasteryAtom` cloud function deployed at `2026-08-01 19:49:54 +08:00`; status `Active/Available`.
- The real phone completed anti-forgetting round 1 through the normal preview-client flow. Read-only CloudBase verification found exactly 20 scoped mastery documents, exactly 10 active `preview_not_mastered` seeds, and all 10 at `reviewCount=1` with the same `lastReviewTime=1785580779540` and `nextReviewTime=1785667179540`.
- The PC client pulled the phone write and showed two scoped learning records (`learning`, `anti_forgetting_review`), 20 mastery entries, 10 active seeds, and no pending mastery/record/progress/preview queues.
- A fresh preview containing the statistics, timestamp, and preview-state fixes was generated at `test-output/cross-client-final-fixes-20260801.png`.
- The user scanned that preview on a real phone and confirmed the current `senior_textbook_real` pages matched the expected values: learned 20, unmastered 10, two learning-history entries, and four remaining anti-forgetting rounds of 10 words each.
- A subsequent PC cold-start pull converged to the same values with `cloudReadOnly=true` and all pending queues still empty.
- No non-test teacher or student data was written or modified during this acceptance.
