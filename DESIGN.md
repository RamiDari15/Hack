# Vendora design system (v3, "Dusk")

Rebuilt from zero on 2026-11-15. The old system is in `_backup_v2_frontend/`.

## The idea
Events happen in the evening, under string lights. The site lives in that hour: a deep violet dusk with warm amber bulbs. The homepage's one big moment is a field of light bulbs that starts as string lights, scatters into an idea, sorts into vendor groups, and lands as the floor plan of a party. Everything else stays quiet so that moment carries the page.

## Color
| Token | Hex | Use |
| --- | --- | --- |
| `--dusk` | #2b2140 | Header, footer, homepage scene, primary buttons |
| `--dusk-2` | #3a2d55 | Raised surfaces on dusk, button hover |
| `--haze` | #f3f0f7 | App page background (cool lavender white, not cream) |
| `--ink` | #22193a | Text on haze |
| `--muted` | #5f5673 | Secondary text on haze (6.4:1) |
| `--bulb` | #ffc861 | The one accent. Light, highlights, the CTA on dusk. Never text on haze (fails contrast) |

On dusk, text is `--on-dusk` #f4effa and secondary `--on-dusk-muted` #c3b8d6 (7.7:1). Status colors (ok, warn, info, danger) are for badges and notices only.

## Type
- **Big Shoulders** (variable, optical size 72) for display only. Condensed, from city signage; reads like a venue marquee. Weight 800, tight leading (0.9), sentence case.
- **Hanken Grotesk** for everything else. 17px body, 1.55 leading, tabular numbers for money.
- No all-caps labels, no eyebrows above headings, no single accented word in a headline.

## Shape
Buttons are full pills (like bulbs). Badges are small 4px tickets. Panels are 8px. Shadows only on things that float (menus).

## Motion
- One orchestrated load: bulbs light up left to right and the headline rises in.
- One scroll story: the bulb field morphs through four states, scrubbed by GSAP ScrollTrigger, with the camera tilting down onto the floor plan in the last step.
- Everything else moves only when the person does something (menus, disclosures).
- `prefers-reduced-motion`: no scroll story. The bulbs render once as still string lights and the three steps read as a normal list. Without WebGL or JavaScript the same list shows on a plain dusk background.
- Rendering pauses when the scene is off screen or the tab is hidden.

## Labels that are part of the product
Every number and listing says where it came from: **Verified** (reviewed business), **External, confirm** (web result), **AI estimate** (planner range), **Vendor quote** (sent by the vendor). These badges keep their names everywhere.
