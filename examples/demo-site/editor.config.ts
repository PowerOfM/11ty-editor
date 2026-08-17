import { defineSite, f } from '@astro-editor/schema'

/**
 * What the client of this site may change.
 *
 * Nothing outside this file is editable — the commit worker derives its
 * writable-path allow-list from the `file` values here, so a document that is
 * not declared simply cannot be written.
 */
export default defineSite({
  name: 'Northwind Joinery',

  documents: {
    /**
     * `global: true` because Footer.astro is imported by every page. The editor
     * warns before an edit here, since one change lands everywhere.
     */
    footer: {
      label: 'Footer',
      file: 'src/data/footer.yaml',
      format: 'yaml',
      global: true,
      fields: {
        tagline: f.text({ label: 'Tagline', max: 120 }),
        copyright: f.text({ label: 'Copyright line', max: 80 }),
        links: f.list({
          label: 'Footer links',
          max: 6,
          itemLabel: 'text',
          of: {
            text: f.text({ label: 'Label', max: 30 }),
            href: f.url({ label: 'Destination' }),
          },
        }),
      },
    },

    home: {
      label: 'Home page',
      file: 'src/content/pages/home.md',
      format: 'markdown',
      previewPath: '/',
      bodyField: 'body',
      fields: {
        title: f.text({ label: 'Headline', max: 80 }),
        intro: f.longtext({ label: 'Intro paragraph', max: 300 }),
        body: f.richtext({
          label: 'Page content',
          allow: ['bold', 'italic', 'link', 'h2', 'h3', 'ul'],
        }),
      },
    },

    about: {
      label: 'About page',
      file: 'src/content/pages/about.md',
      format: 'markdown',
      previewPath: '/about',
      bodyField: 'body',
      fields: {
        title: f.text({ label: 'Headline', max: 80 }),
        intro: f.longtext({ label: 'Intro paragraph', max: 300 }),
        body: f.richtext({ label: 'Page content', allow: ['bold', 'italic', 'link', 'h2', 'ul'] }),
      },
    },
  },

  theme: {
    file: 'src/data/theme.json',
    tokens: {
      '--color-brand': f.color({ label: 'Brand colour' }),
      '--color-ink': f.color({ label: 'Text colour' }),
      '--radius': f.length({ label: 'Corner radius', unit: 'px', min: 0, max: 24 }),
    },
  },
})
