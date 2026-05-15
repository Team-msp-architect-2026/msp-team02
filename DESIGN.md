# 법대로(LawMainRoad) Design Direction

Date: 2026-04-29

This document defines the visual direction for 법대로(LawMainRoad) after the latest
frontend route-level polish. It replaces the earlier IBM Carbon-clone direction
with a trusted labor-rights SaaS direction that keeps public-service clarity:
calm, trustworthy, accessible, workflow-oriented, and useful for Korean-first
legal workflows.

Implementation note: frontend CSS must continue to use the canonical `--kl-*`
tokens in `frontend/src/app/globals.css`. Do not introduce `--cds-*`, `--govuk-*`,
`--krds-*`, or third-party design-system prefixes in component CSS. External
systems below are references for judgment, not dependencies.

Current scope note: visual polish must preserve the SCN-004 demo freeze, SCN-001
protected Bridge answer/history behavior, SCN-001 frozen draft path, Firebase
Auth in-memory persistence, and all public API contracts. This document is a
frontend visual guide only.

## 1. Reference Stack

Use these references in combination, not as a single style to copy.

| Reference | Use it for | Avoid copying |
|---|---|---|
| [Gusto](https://gusto.com/product) | Warm HR/labor SaaS tone, approachable compliance workflows, friendly neutral-and-accent balance | Payroll marketing, playful illustrations that weaken legal seriousness, pricing/sales-page density |
| [LegalZoom](https://www.legalzoom.com/) | Guided legal self-service, step-by-step forms, plain-language legal confidence | US legal-service identity, consumer upsell patterns, attorney-marketplace framing |
| [Juro](https://juro.com/) | Document workspace, draft/review lifecycle, legal guardrail presentation | Enterprise CLM complexity, marketing-heavy hero sections inside work routes |
| [Humaans](https://humaans.io/) | Modern HRIS workflow density, clean records, compact operational screens | Dark premium SaaS mood or over-polished admin dashboards |
| [KRDS](https://www.krds.go.kr/html/site/style/style_02.html) | Korean public-service tone, 60-30-10 color balance, state/system color discipline | Heavy government portal density or institutional noise |
| [GOV.UK Design System](https://design-system.service.gov.uk/styles/colour/) | Accessible forms, visible focus, errors, warnings, plain-language service UI | Raw UK visual identity or black/yellow overuse |
| [Wise Design - Colour](https://wise.design/foundations/colour) | White/neutral-first screens with restrained accent color | Bright accent as decoration across every card |
| [Linear design refresh](https://linear.app/now/behind-the-latest-design-refresh) | Dense internal route polish, softened structure, quiet navigation | Dark SaaS mood or decorative gradients |
| [Atlassian color](https://atlassian.design/foundations/color) | Role-based color tokens: neutral, brand, info, success, warning, danger | Treating decorative accents as status colors, or replacing semantic status colors with arbitrary accents |
| [Docketwise](https://www.docketwise.com/) / [Clio](https://www.clio.com/) | Legal-tech confidence, product screenshots, case/document framing | Marketing-heavy hero treatment inside workflow screens |
| [Mobbin](https://mobbin.com/) / [Page Flows](https://pageflows.com/) | Real app flow references for onboarding, history, forms, results | Static visual trends without checking the full user flow |

## 2. Design Positioning

법대로(LawMainRoad) should feel like a trusted labor-rights SaaS with public-service
clarity: safe like a public service, but warmer and more guided than a blank
government form. It should not feel like a consumer AI chat toy, a generic
polished SaaS shell, or a law-firm marketing site.

The right mood is:

- Calm enough for stressful labor disputes.
- Warm enough to feel approachable as a product people can return to.
- Clear enough for non-expert and foreign worker users.
- Structured enough for legal evidence, citations, and document drafting.
- Modern enough to feel credible as an AI product.
- Restrained enough to avoid implying legal certainty beyond the retrieved
  evidence.

Core design idea: use Gusto-like warmth as the product tone, LegalZoom-like
guided steps for legal workflows, Juro-like document workspace structure, and
public-service discipline for evidence, warnings, and accessibility.

In practice: use neutral surfaces for most of the interface, one primary action
color for user decisions, and semantic colors only for actual status or risk.

Temperature rule: the main page and empty states may feel warmer and more
product-like. Internal work routes should stay neutral, dense, and legal-workspace
oriented. Warmth should make the product approachable; it must not make legal
analysis, evidence gaps, or draft limitations feel casual.

## 3. Visual Principles

### Public-Service Trust

- Prefer plain surfaces, strong hierarchy, and explicit labels over decorative
  effects.
- Keep Korean copy primary and English secondary.
- Use color to guide actions and explain status, not to decorate every section.
- Show legal citations, evidence needs, and cautions as structured information,
  not as visual badges competing for attention.

### Document-Centered Workflows

- `/after/draft` should read like a document workspace: preview, missing fields,
  cautions, evidence checklist, legal basis, copy, and print.
- Document preview should be visually calmer than surrounding controls.
- Missing facts must remain visually distinct from completed facts.
- Do not use design polish to hide uncertainty. `missing_fields`, cautions, and
  draft disclaimers stay prominent.

### Dense But Scannable Internal Routes

- `/before`, `/after`, `/history`, and `/after/result` are work screens.
- Treat internal routes as neutral legal workspaces, not marketing pages.
- Avoid oversized hero treatment on internal routes.
- Prefer compact headers, clear route context, and grouped panels.
- Let the main task area carry the strongest visual weight.
- Navigation and secondary controls should recede after orientation is clear.

### Main Page Exception

The main page may be more expressive, but it should still start with the actual
service value and product path. For logged-out users, the first viewport can
prioritize Google login. For backend-verified users, keep `History / Before /
After` entry order.

If the main page is visually expanded later, use either a real product screenshot
composition or a generated bitmap image that communicates labor/legal support.
Do not use abstract gradient-only hero art.

### Known Legacy Drift

The following notes track remaining or recently reduced drift. These files
should be audited against the token-first direction when touched, not used as
authoritative visual references:

- `frontend/src/components/before/ResultPanel.module.css` has already moved
  away from the earlier dark gradient hero surface and now mostly uses
  `--kl-*` tokens. If this area changes again, still audit
  `frontend/src/app/before/page.module.css` `.bridgeCta*` rules in the same
  patch because they were historically coupled to the result surface.
- `frontend/src/components/before/UploadPanel.module.css` no longer uses the
  earlier broad gradient dropzone/button treatment, but it still carries local
  shadow treatments and upload-specific interaction styling that should be
  checked against the dense workspace tone when modified.
- `frontend/src/components/before/AccessibilityPanel.module.css` is mostly on
  the `--kl-*` surface now; keep it neutral and operational if touched.
- `frontend/src/components/draft/DocumentPreview.module.css` still contains
  hardcoded print/document colors and shadow treatment. Its `@media print`
  rules and `.printDisclaimer` behavior are part of the SCN-004
  print/disclaimer freeze and must not be removed.
- `frontend/src/components/auth/LoginButton.module.css` is token-aligned in the
  current implementation. Keep future auth-state styling inside the `--kl-*`
  token surface.

Polish patches should bring these files into the `--kl-*` token surface. Do not
treat their current visual output as the approved baseline.

## 4. Color System

### Current Implementation Tokens

The full `--kl-*` token surface is defined in
`frontend/src/app/globals.css`. The table below lists the tokens most relevant
to visual decisions, but components must respect the entire token set, including
`--kl-surface-01`, `--kl-surface-02`, `--kl-surface-warning`,
`--kl-surface-info`, `--kl-surface-success`, `--kl-surface-danger`,
`--kl-text-warning`, `--kl-text-danger`, `--kl-text-success`,
`--kl-primary-hover`, and `--kl-primary-active`. Status pills, notice surfaces,
result severity badges, and evidence/caution borders should use existing tokens
rather than redefining route-local hex values.

The current frontend already defines the working `--kl-*` palette:

| Role | Token | Current value |
|---|---|---|
| Page background | `--kl-bg` | `#ffffff` |
| Page surface | `--kl-surface-page` | `#f4f4f4` |
| Card surface | `--kl-surface-card` | `#ffffff` |
| Primary text | `--kl-text-primary` | `#161616` |
| Secondary text | `--kl-text-secondary` | `#525252` |
| Primary action | `--kl-primary` | `#0f62fe` |
| Primary light surface | `--kl-primary-light` | `#edf5ff` |
| Warning | `--kl-warning` | `#f1c21b` |
| Danger | `--kl-danger` | `#da1e28` |
| Success | `--kl-success` | `#24a148` |
| Border | `--kl-border` | `#c6c6c6` |
| Focus | `--kl-focus` | `#0f62fe` |

These values are acceptable for the current MVP. Future color changes should be
done by remapping these tokens, not by hardcoding new hex values in route CSS.

### Recommended Direction

Use the KRDS/Wise ratio as the practical rule:

- 60 percent neutral: backgrounds, cards, borders, body text.
- 30 percent supporting structure: subtle blue-gray surfaces, side panels,
  folded history details, secondary chips.
- 10 percent primary or semantic color: CTA, active state, warning, danger,
  success, focus.

The UI should not become a one-color blue app. Blue should mean action,
selection, or information. It should not be used as a blanket decorative wash.

The product may still feel warm and SaaS-like. Use warmth through off-white
surfaces, soft neutral panels, clear cards, friendly empty states, and small
accent moments. Do not create warmth through broad gradients, floating glow
objects, or color applied to every card.

Warm surfaces must not dominate the app. Avoid beige/cream/tan as the main page
system color; it can make the product feel like HR coaching or consultation
landing pages instead of a labor-rights legal workspace.

Recommended accent behavior:

- Primary blue/teal: main decisions, selected states, trusted information.
- Warm amber: caution, missing information, "prepare this next" guidance.
- Soft green: completed, verified, saved, or successfully linked state.
- Coral/red: destructive actions and true risk only.
- Neutral blue-gray: history folds, secondary panels, supporting structure.

### Future Token Value Remap Candidate

The token names below already exist in `frontend/src/app/globals.css`. This
section proposes future value changes only, not new token names. Any change
should be a single token-remap patch followed by full route screenshot
regression. Token names like `--kl-primary`, `--kl-primary-hover`,
`--kl-primary-light`, and `--kl-surface-01` are not new; only their values would
change.

The current `#0f62fe` primary is acceptable for MVP stability, but it reads as
more IBM/technical than legal/public-service. Do not remap it casually. If token
work is reopened, validate a calmer blue across all major routes with screenshots
before merging.

| Role | Token | Candidate value | Reason |
|---|---|---:|---|
| Primary action | `--kl-primary` | `#1d70b8` | Public-service blue with calmer saturation |
| Primary hover | `--kl-primary-hover` | `#0f385c` | Strong accessible hover |
| Primary active | `--kl-primary-active` | `#0b2f4f` | Pressed state |
| Primary light | `--kl-primary-light` | `#e8f1f8` | Soft selection surface |
| Page surface | `--kl-surface-page` | `#f4f8fb` | Slight blue-gray public-service surface |
| Neutral surface | `--kl-surface-01` | `#eef3f7` | Quiet grouping layer |
| Border | `--kl-border` | `#c8d3df` | Softer but visible boundaries |
| Focus | `--kl-focus` | `#ffdd00` | Highly visible keyboard focus |
| Danger | `--kl-danger` | `#ca3535` | Error/destructive state |
| Success | `--kl-success` | `#0f7a52` | Completion/verified state |
| Warning | `--kl-warning` | `#f1c21b` | Caution background or icon, not body text |

Before changing tokens, check major routes in desktop and mobile screenshots:
`/`, `/before`, `/after`, `/after/result`, `/after/intake`, `/after/draft`,
and `/history`.

If `#ffdd00` is used for focus, treat it as focus-only. Do not reuse the same
yellow as a general warning fill, or focus and caution states will compete.
Warning should use softer amber surfaces and explicit text/icon treatment; focus
must remain a keyboard navigation affordance, not a warning style.

## 5. Typography

Current IBM Plex usage is acceptable because it gives the MVP a technical,
document-oriented tone. Keep it unless Korean readability becomes a problem.

Rules:

- Use system-sized type for work screens. Do not use hero-scale text inside
  cards, sidebars, history records, or document panels.
- Keep Korean reading line-height generous, especially in draft preview and
  cautions.
- Use 600 weight for labels and important card titles. Avoid excessive bold
  text in long Korean paragraphs.
- Use mono only for technical identifiers, article-like compact labels, or
  citation pills. Do not show raw job ids, Firebase ids, internal ids, or raw
  provider errors in user-facing UI.
- Avoid negative letter spacing. The current small positive tracking tokens are
  acceptable for compact captions.

## 6. Layout And Structure

### Internal Routes

- Use a light masthead and restrained route headers.
- Keep the main content width stable; avoid components that resize when a status
  label, icon, or hover state appears.
- Use full-width page bands or unframed layouts for major sections.
- Use cards for repeated records, document panels, and modals only.
- Do not put cards inside cards.
- Use folds/details for secondary history information instead of showing every
  detail at once.

### Cards

- Cards should use `--kl-radius-md` (8px) as the maximum radius.
- `--kl-radius-lg` (12px), `--kl-radius-xl` (20px), `--kl-radius-2xl` (24px),
  and `--kl-radius-pill` (24px) exist in `globals.css` for legacy or narrow
  component needs; do not apply them to new card or panel surfaces.
- `--kl-radius-pill` is acceptable only on tag/chip-shaped controls smaller than
  32px tall. `--kl-radius-control` (0px) remains the button/control radius.
- Avoid large round cards and bubbly surfaces.
- Borders should usually do the structural work. Use shadows sparingly for
  actual elevation or home-page presentation, not every internal panel.
- Repeated incident cards should prioritize:
  - situation summary
  - confirmed issues
  - candidate legal references
  - recommended next steps
  - After question connection

### Forms

- For long legal text entry, boxed textareas are clearer than bottom-border-only
  fields.
- Labels should sit close to inputs and helper text should be short.
- Errors must include text and visual treatment. Do not rely on red alone.
- Required/missing information should be phrased as next action, not blame.
- Keep touch targets around 44-48px minimum.

### Buttons And Controls

- Primary button: one per decision area when possible.
- Secondary button: neutral outline or subtle surface.
- Tertiary/ghost button: low-risk navigation or reset.
- Destructive actions: explicit confirmation, restrained danger color, no
  oversized red areas.
- Icon buttons should use familiar icons with accessible names/tooltips.
- Do not use decorative icon containers when plain icons are enough.
- The current `frontend/src/components/ui/Button.module.css` `.secondary`
  variant fills with `--kl-text-secondary`, which contradicts the neutral
  outline/subtle-surface rule. Polish work that depends on credible secondary
  actions should rework that variant instead of styling around it.

## 7. Route Guidance

### `/`

- Logged-out first viewport: login CTA and clear explanation of why login helps.
- Backend-verified logged-in first viewport: `History / Before / After` entry
  order.
- This route may carry the warmest product tone, but it must still show the
  actual service path rather than a generic SaaS hero.
- Make the service itself visible in the first viewport. Avoid a generic AI
  landing page.
- If visuals are added, use a product screenshot, realistic document/workflow
  composition, or generated bitmap image tied to labor/legal help.

### `/before`

- Keep this route more neutral than the main page. The upload, progress, and
  result areas should feel patient and operational, not promotional.
- Treat upload, progress, result, and accessibility guidance as one workflow.
- Progress state should feel stable and patient. OCR can take about 1-2 minutes.
- Hide raw provider/job/internal details.
- History/delete actions must remain visibly lower priority than the analysis
  task.

### `/after`

- Keep this route as a decision workspace. Warm accents may support orientation,
  but the question/preset/history controls should remain clear and restrained.
- Keep preset and free-input paths visually distinct but not competing.
- Saved history selector should feel like a helper panel, not the primary page
  unless the user opens it.
- Bridge handoff context is continuity, not legal grounding.
- Do not expose raw `after_query_seed`, Bridge payload, real bridge id, token,
  Firebase uid, provider subject, or email.

### `/after/result`

- Keep the tone neutral and evidence-led. Do not make the answer result feel like
  a success landing page.
- Lead with answer summary and next available action.
- Draft eligibility should be clear without implying that every answer can
  become a document.
- If Bridge-origin or live modified SCN-001 is answer-only, make draft-disabled
  state quiet but explicit.
- Candidate legal references must remain tied to retrieved answer evidence.

### `/after/intake`

- Use a narrow form width and predictable grouping.
- Keep legal/document terms consistent with `/after/result`.
- Missing optional fields should not visually look like errors.
- Keep SCN-004 public draft flow and SCN-001 frozen draft path separated.

### `/after/draft`

- This should be the calmest and most document-like route in the app.
- Document preview gets the calmest surface and strongest reading rhythm.
- Copy/print controls should stay reachable without covering content.
- Print preview styling should preserve the disclaimer and readable document
  body.
- Missing fields, cautions, and evidence checklist must remain visible before
  the user treats the draft as final.

### `/history`

- Treat this as a saved work archive, not a dashboard showcase.
- Keep the incident-centered single-card model.
- Do not split Before and Bridge into unrelated columns.
- Details/fold sections are appropriate for density.
- Failed/running Before jobs remain hidden from the user-facing archive.
- Delete affordances stay available but visually secondary.

## 8. Accessibility Rules

- Target WCAG AA contrast for text and interactive elements.
- Do not communicate status by color alone. Pair color with text and, where
  useful, an icon.
- Keyboard focus must be obvious on all controls. The future focus token can use
  yellow, but it must be tested against all surfaces.
- Respect `prefers-reduced-motion`.
- Text must not overlap or truncate awkwardly on mobile. Long Korean words or
  legal terms should wrap cleanly.
- Avoid placeholder-only instructions. Labels must remain visible.
- Use plain language for warnings and legal uncertainty.
- Today, `--kl-focus` is the same value as `--kl-primary` (`#0f62fe`).
  Components that use primary color for selected state and border can produce
  stacked blue treatments when keyboard-focused. A future remap should give
  `--kl-focus` a value distinct from `--kl-primary` so focus reads as keyboard
  navigation, not as part of the selected state. Until then, polish work should
  not add extra blue borders or shadows to interactive elements.

## 9. Visual Do And Do Not

### Do

- Keep the product feeling like a useful labor/legal SaaS, not a blank
  government form.
- Borrow Gusto's warmth, LegalZoom's guided legal flow, Juro's document
  workspace clarity, and Humaans' compact workflow density.
- Use neutral-first surfaces with a restrained public-service blue.
- Use semantic color roles consistently: information, success, warning, danger.
- Keep route headers compact and work-focused.
- Use folds to manage dense case records.
- Use product screenshots or realistic workflow imagery on the main page if a
  stronger visual identity is needed.
- Update tokens centrally through `--kl-*`.

### Do Not

- Do not copy Gusto, LegalZoom, Juro, Humaans, Carbon, KRDS, GOV.UK, Wise,
  Linear, Atlassian, Clio, or Docketwise wholesale.
- Do not add broad gradients, decorative orbs, bokeh blobs, or purely atmospheric
  backgrounds.
- Do not interpret "Gusto-like warmth" as pastel-heavy cards, bubbly radius,
  decorative illustrations, or soft shadows on every panel.
- Do not make beige, cream, sand, tan, or amber the dominant app palette.
- Do not turn every card into a colored card.
- Do not use blue as a decorative wash across whole pages; blue should indicate
  action, selection, or information.
- Do not use color as legal certainty.
- Do not hide missing facts, disclaimers, or draft limitations for visual polish.
- Do not change backend/API/schema, auth persistence, Web Storage policy, or
  SCN-004 freeze behavior as part of design polish.

## 10. Agent Prompt Guide

Use this when asking an agent to continue visual work:

> Polish the selected 법대로(LawMainRoad) route using the DESIGN.md direction. Keep
> `--kl-*` tokens, preserve SCN-004 freeze and SCN-001 protected/frozen paths,
> keep Korean primary copy, avoid API/schema/auth/storage changes, use a warm
> labor/legal SaaS tone with neutral surfaces and restrained semantic color,
> make the main page warmer than internal work routes, keep internal routes
> neutral and evidence-led, maintain accessible focus/error states, and verify
> desktop/mobile layout.

Good focused prompts:

- "Audit `Scn001HistoryManager.module.css` for hardcoded notice/error/status
  colors and remap them to existing `--kl-surface-info`,
  `--kl-surface-danger`, and `--kl-surface-success` tokens. Do not change API
  data mapping or fold structure."
- "Polish `/after/draft` document workspace so preview, missing fields,
  cautions, checklist, copy, and print feel visually aligned. Do not change draft
  data or print contract."
- "Rework main page visual direction using product workflow imagery and
  backend-verified login priority. Do not change auth persistence or route
  behavior."
- "Adjust route color and spacing toward Gusto-like warmth and Juro-like document
  clarity while preserving legal uncertainty, missing fields, and disclaimers."
- "Evaluate whether the future public-service palette can be remapped in
  `globals.css`, then screenshot all major routes before and after."

Verification for design-only changes:

- `git diff --check`
- `cd frontend && npm run build` when CSS/TSX changes are made
- Manual browser screenshots for desktop and mobile when layout or tokens change
- Print preview rehearsal when `/after/draft` or print CSS changes
- When touching `frontend/src/components/draft/DocumentPreview.*`, preserve the
  `@media print` block and `.printDisclaimer` print behavior. Losing these can
  silently break the SCN-004 print/disclaimer flow without failing build.
- When touching `frontend/src/components/before/ResultPanel.*`, audit
  `frontend/src/app/before/page.module.css` `.bridgeCta*` rules in the same
  patch because this area was historically coupled to the result surface.
- Do not rewrite route-level layout JSX as part of a CSS polish patch. CSS-only
  patches preserve route gating, history selector logic, freeze policies, and
  saved-history privacy more reliably than JSX rewrites.
