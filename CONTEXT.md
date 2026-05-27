# Grill Session

Grill Session is the product context for interactive decision-tree interviews in pi. It covers questionnaire-driven grill rounds, user answer capture, and temporary helper conversations used while answering.

## Language

**Questionnaire Batch**:
A set of current-frontier questions shown together in the pi TUI and submitted as one structured answer payload.
_Avoid_: form, survey

**Source Question**:
The questionnaire question from which a helper conversation is opened; its prompt, options, recommendation, current draft answer, and notes anchor that helper conversation.
_Avoid_: originating tab, parent question

**Side Session Context Package**:
The launch prompt and references given to a Side Session: Source Question details, current batch/questionnaire context, and a pointer to the current parent session branch, using compaction summaries when present, so the child can summarize relevant plan context itself before helping answer.
_Avoid_: parent-generated full summary, hidden context, entire session tree

**Side Session**:
A temporary pi conversation opened from a Source Question to help the user understand the question, explore possible answers, and optionally draft a selected option, notes, or custom answer without advancing the parent grill session by itself.
_Avoid_: escape hatch, nested grill

**Side Session Action**:
The per-question questionnaire row that opens a Side Session for the active Source Question in any interactive questionnaire, not only grill-mode questionnaires.
_Avoid_: global escape, hidden shortcut, grill-only affordance

**Side Session Overlay**:
A blocking child-`pi` process launched from the questionnaire after the parent TUI is temporarily suspended; it runs an interactive helper conversation while the parent questionnaire remains blocked and recoverable, then resumes the parent TUI after child exit. It is unavailable in no-UI questionnaire fallback paths.
_Avoid_: inline panel, modal chat, headless helper, headless side session

**Project Read-Only Mode**:
A Side Session constraint where the child starts in the parent project and may inspect project files but must not mutate files in that project; mutations outside the project remain allowed under normal pi tool rules.
_Avoid_: no-tools mode, global read-only

**Return Mode**:
The user-selected way a Side Session affects the Source Question after the helper conversation ends: either manual return with no answer changes, or semi-automatic return that imports a helper-suggested selected option, notes, or custom answer for review in the parent questionnaire.
_Avoid_: auto-submit, handoff

**Return Suggestion**:
A concrete draft answer payload produced by a child-side return tool or `/grill-side-return` command into a sidecar JSON file and shown to the user before changing the Source Question draft; it matches the existing answer model exactly: selected option plus optional notes, or custom answer.
_Avoid_: automatic answer, final submission, rich third answer mode

**Side Session Return Surface**:
The child-side mechanisms that write a Return Suggestion for the parent questionnaire: `grill_side_return_option`, `grill_side_return_custom`, or the interactive `/grill-side-return` command. These surfaces require explicit user confirmation in the child and never submit the parent questionnaire.
_Avoid_: parent submit command, automatic import tool

**Side Session Record**:
A persisted reference to the current Side Session for a Source Question that keeps a concise summary plus enough transcript/session identity for the user to read the helper conversation again from that question tab; each Source Question has at most one record in an unsubmitted batch, and replacement requires confirmation.
_Avoid_: inline full transcript, multiple concurrent records per question

**Import Dialog**:
The post-exit overlay shown above the blocked parent questionnaire that lets the user manually return, import a Return Suggestion, view the Side Session Record, or discard it.
_Avoid_: auto-apply, hidden import

## Example dialogue

User: "I do not understand this option; open a side session from this question."

Side Session: "Given the source question and current plan summary, option B means the helper can draft notes but the parent questionnaire will not submit automatically."

User: "Return semi-automatically with option B and these notes."

Parent Questionnaire: "The source question now shows option B and draft notes; the user can still edit or clear them before submitting the questionnaire batch."
