import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';

// Vitest runs from backend/ (vitest.config.mts); jsdom gives import.meta.url an http: scheme, so paths start there.
const REACT_ROOT = join(process.cwd(), 'assets', 'react');
const TOKENS = join(REACT_ROOT, 'shared', 'ui', 'styles', 'tokens.css');

type Theme = 'light' | 'dark';

/** The `--kf-*: #hex` declarations of a block of tokens.css (the light ones under :root, the dark ones after). */
function tokensOf(theme: Theme): Record<string, string> {
  const css = readFileSync(TOKENS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const selector = theme === 'light' ? ':root' : "html[data-theme='dark']";
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  const found: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(
    /(--kf-[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi,
  )) {
    found[name!] = value!.toLowerCase();
  }
  return found;
}

/** WCAG 2.x relative luminance of #rrggbb. */
function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [foreground, background, minimum]: 4.5 for text, 3 for control borders and the focus ring (WCAG 1.4.11). */
const PAIRS: [string, string, number][] = [
  ['--kf-text', '--kf-bg', 4.5],
  ['--kf-text', '--kf-surface', 4.5],
  ['--kf-text', '--kf-surface-sunken', 4.5],
  ['--kf-text', '--kf-surface-raised', 4.5],
  ['--kf-text-muted', '--kf-bg', 4.5],
  ['--kf-text-muted', '--kf-surface', 4.5],
  ['--kf-text-muted', '--kf-surface-sunken', 4.5],
  ['--kf-text-muted', '--kf-surface-raised', 4.5],
  ['--kf-border-strong', '--kf-surface', 3],
  ['--kf-border-strong', '--kf-bg', 3],
  ['--kf-on-accent', '--kf-accent', 4.5],
  ['--kf-on-accent', '--kf-accent-hover', 4.5],
  ['--kf-focus', '--kf-surface', 3],
  ['--kf-focus', '--kf-bg', 3],
  ['--kf-link', '--kf-bg', 4.5],
  ['--kf-link', '--kf-surface', 4.5],
  ['--kf-link', '--kf-surface-sunken', 4.5],
  ['--kf-link', '--kf-accent-soft', 4.5],
  ['--kf-text', '--kf-accent-soft', 4.5],
  ['--kf-on-danger', '--kf-danger', 4.5],
  ['--kf-on-danger', '--kf-danger-hover', 4.5],
  ['--kf-danger', '--kf-surface', 4.5],
  ['--kf-danger-text', '--kf-danger-soft', 4.5],
  ['--kf-on-warning', '--kf-warning', 4.5],
  ['--kf-warning-text', '--kf-warning-soft', 4.5],
  ['--kf-on-info', '--kf-info', 4.5],
  ['--kf-info-text', '--kf-info-soft', 4.5],
  ['--kf-neutral-text', '--kf-neutral-soft', 4.5],
  ['--kf-text', '--kf-danger-soft', 4.5],
  ['--kf-text', '--kf-warning-soft', 4.5],
  ['--kf-sidebar-text', '--kf-sidebar', 4.5],
  ['--kf-sidebar-muted', '--kf-sidebar', 4.5],
  ['--kf-sidebar-active', '--kf-sidebar', 4.5],
  ['--kf-sidebar-text', '--kf-sidebar-hover', 4.5],
  ['--kf-sidebar-active', '--kf-sidebar-hover', 4.5],
];

describe('design tokens', () => {
  it('computes contrast as WCAG does', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#5d7b2b', '#ffffff')).toBeCloseTo(4.85, 2);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`meets AA for every pair the screens use, ${theme} theme`, () => {
      const tokens = {...tokensOf('light'), ...tokensOf(theme)};
      const failures = PAIRS.flatMap(([fg, bg, min]) => {
        const [a, b] = [tokens[fg], tokens[bg]];
        if (!a || !b) return [`${fg} on ${bg}: not defined`];
        const ratio = contrast(a, b);
        return ratio >= min
          ? []
          : [`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`];
      });
      expect(failures).toEqual([]);
    });
  }

  it('defines every colour of the light theme again for dark', () => {
    const light = Object.keys(tokensOf('light'));
    const dark = new Set(Object.keys(tokensOf('dark')));
    expect(light.filter((name) => !dark.has(name))).toEqual([]);
  });

  it('keeps hex colours in tokens.css only', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (name.endsWith('.css') && path !== TOKENS) {
          const css = readFileSync(path, 'utf8').replace(
            /\/\*[\s\S]*?\*\//g,
            '',
          );
          if (/#[0-9a-f]{3,8}\b/i.test(css)) {
            offenders.push(relative(REACT_ROOT, path));
          }
        }
      }
    };
    walk(REACT_ROOT);
    expect(offenders).toEqual([]);
  });
});
