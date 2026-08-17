# astro-editor

A visual editor that lets clients change the text, images and theme of their
statically-deployed Astro site, where **Save produces a real git commit** and the
repo stays the single source of truth.

The full architecture and rationale live in [DESIGN.md](./DESIGN.md).

## The shape of it, in one paragraph

Astro components run at build time and compile away to HTML, so there is no
component tree in the browser to drive. That rules out canvas-style builders
(GrapesJS, Craft.js) and points at an **overlay editor**: render the real site in
an iframe, overlay edit affordances on annotated regions, and mutate a
structured content store rather than HTML. Editing a shared component's copy
then propagates for free — the footer's text lives in one data file that
`Footer.astro` reads, so one edit reaches every page that imports it.

## Status

**P0 complete.** The content contract and the site-side runtime exist and are
tested. Nothing commits to git yet — that is P1.

| Phase | What | State |
|---|---|---|
| P0 | Schema, diff-stable serialization, `ed()`, demo site | done |
| P1 | Commit worker: GitHub App auth, Git Data API, path allow-list | next |
| P2 | Editor SPA with a schema-generated field panel | |
| P3 | `bridge.js`, iframe overlay, optimistic patching | |
| P4–P6 | Images, theme tokens, multi-tenancy | |

## Layout

```
packages/schema   @astro-editor/schema   field types, validation, serialization
packages/astro    @astro-editor/astro    Astro integration + ed() runtime
examples/demo-site                       two pages sharing one Footer
```

## Getting started

```sh
pnpm install
pnpm build          # build the packages (the demo site consumes dist/)
pnpm test           # 71 tests, including a full two-mode site build
```

Run the demo site:

```sh
cd examples/demo-site
pnpm dev                    # production mode — no editor output at all
EDITOR_MODE=1 pnpm dev      # edit mode — templates emit data-ed annotations
```

## The two invariants worth knowing about

**Saves produce reviewable diffs.** `serialize(parse(source))` is byte-identical
for every fixture, and editing one field changes exactly one line — comments,
key order, quoting style and CRLF endings all survive. This is why the
serializer patches a parsed `yaml` Document rather than regenerating the file,
and why `gray-matter` is deliberately not used: it re-serializes frontmatter
through js-yaml and loses all of that.

**Production ships zero editor footprint.** `packages/astro/test/parity.test.ts`
builds the demo site twice, with and without `EDITOR_MODE=1`, and asserts the
production output contains no `data-ed` attributes, no bridge script and no
`/_ed/` asset. The same test asserts both pages carry identical `footer.*`
paths, which is the propagation guarantee stated as an executable claim.

## Adding the editor to a site

Annotate templates by spreading `ed()` onto elements that already exist — it
adds no wrappers and changes no layout:

```astro
---
import { ed } from '@astro-editor/astro/runtime'
import { footer } from '../lib/content'
---
<p {...ed('footer.tagline')}>{footer.tagline}</p>
```

Then declare what is editable in `editor.config.ts`. That file is the only thing
that makes a path writable — the commit worker derives its allow-list from the
`file` values and never accepts a path from the client.
