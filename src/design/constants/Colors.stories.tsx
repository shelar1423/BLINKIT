import type { Meta, StoryObj } from '@storybook/react-vite';
import { color, scene, type Token } from './colors';
import { radius, fontSize, space, chrome } from './layout';

/**
 * The palette, rendered from the Constants module itself — so this page cannot
 * drift from the code the app actually uses. `npm run check:tokens` separately
 * asserts these match tokens.css, and fails the build if they don't.
 */
const meta = { title: 'Constants/Colour' } satisfies Meta;
export default meta;
type Story = StoryObj;

function Swatch({ name, token }: { name: string; token: Token }) {
  return (
    <div style={{ border: '1px solid #E8E8E8', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: token.hex, height: 62 }} />
      <div style={{ padding: '8px 10px', fontSize: 11, lineHeight: 1.6 }}>
        <b style={{ display: 'block', fontSize: 12 }}>{name}</b>
        <code style={{ color: '#666' }}>{token.hex}</code>
        <br />
        <code style={{ color: '#666' }}>0x{token.int.toString(16).padStart(6, '0')}</code>
        <br />
        <code style={{ color: '#666' }}>{token.css}</code>
      </div>
    </div>
  );
}

function Group({ title, note, names }: { title: string; note?: string; names: (keyof typeof color)[] }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h3 style={{ font: '700 15px system-ui', margin: '0 0 2px' }}>{title}</h3>
      {note && <p style={{ font: '400 12px system-ui', color: '#666', margin: '0 0 10px' }}>{note}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))', gap: 10 }}>
        {names.map((n) => (
          <Swatch key={n} name={n} token={color[n]} />
        ))}
      </div>
    </section>
  );
}

export const Palette: Story = {
  render: () => (
    <div style={{ font: '400 13px system-ui', padding: 4 }}>
      <Group
        title="Brand"
        note="Yellow is the ground, green is the action. Read off blinkit.com's own :root, not invented."
        names={['yellow', 'yellowDk', 'yellowLt', 'yellowTint', 'green', 'greenDk', 'green2', 'greenTint']}
      />
      <Group title="Neutrals" names={['ink', 'ink2', 'mut', 'mut2', 'line', 'line2', 'surface', 'surface2', 'appbase']} />
      <Group
        title="Campaign · Hot Wheels"
        note="Hot Wheels yellow (#FFC400) is deliberately absent: it collides with Blinkit's #F8CB46, so the campaign leads with flame red."
        names={['hwR', 'hwRDk', 'hwRTint', 'hwO', 'hwB']}
      />
      <Group title="Dark surfaces" note="The 3D race and AR viewports only, never commerce chrome." names={['tk1', 'tk2', 'tkMut']} />

      <section>
        <h3 style={{ font: '700 15px system-ui', margin: '0 0 2px' }}>Scene</h3>
        <p style={{ font: '400 12px system-ui', color: '#666', margin: '0 0 10px' }}>
          Used only by three.js, so not CSS custom properties, but the same palette.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))', gap: 10 }}>
          {Object.entries(scene).map(([k, v]) => {
            const hex = typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : v;
            return (
              <div key={k} style={{ border: '1px solid #E8E8E8', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: hex, height: 62 }} />
                <div style={{ padding: '8px 10px', fontSize: 11 }}>
                  <b style={{ display: 'block', fontSize: 12 }}>{k}</b>
                  <code style={{ color: '#666' }}>{hex}</code>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  ),
};

export const Scale: Story = {
  name: 'Radius, spacing & type',
  render: () => (
    <div style={{ font: '400 13px system-ui', display: 'grid', gap: 24, padding: 4 }}>
      <section>
        <h3 style={{ font: '700 15px system-ui', margin: '0 0 10px' }}>Radius</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {Object.entries(radius).map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: color.yellow.hex, borderRadius: v }} />
              <code style={{ fontSize: 11 }}>{k} · {v}px</code>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 style={{ font: '700 15px system-ui', margin: '0 0 10px' }}>Type scale (mobile)</h3>
        {Object.entries(fontSize).map(([k, v]) => (
          <p key={k} style={{ fontSize: v, margin: '0 0 6px' }}>
            {k} · {v}px · Delivery in 8 minutes
          </p>
        ))}
      </section>
      <section>
        <h3 style={{ font: '700 15px system-ui', margin: '0 0 10px' }}>Layout</h3>
        <code style={{ fontSize: 12 }}>
          gutter {space.gutter}px · wide {space.gutterWide}px · header {chrome.headerHeight}px · nav {chrome.navHeight}px
        </code>
      </section>
    </div>
  ),
};
