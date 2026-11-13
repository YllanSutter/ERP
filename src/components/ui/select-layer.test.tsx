import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SelectContent } from './select';
import { SelectLayerContext } from './select-layer';
import { SettingsDialog } from './settings-panel';

// Render portal content in place to inspect the effective stacking level.
vi.mock('@radix-ui/react-select', async (importOriginal) => ({
  ...await importOriginal<typeof import('@radix-ui/react-select')>(),
  Root: ({ children }: any) => children,
  Portal: ({ children }: any) => children,
  Content: React.forwardRef(({ children, position: _, ...props }: any, ref: any) => <div ref={ref} {...props}>{children}</div>),
  Viewport: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  ScrollUpButton: ({ children }: any) => <div>{children}</div>,
  ScrollDownButton: ({ children }: any) => <div>{children}</div>,
}));

// Inspect the provider emitted by the shared dialog without mounting a browser dialog.
vi.mock('./dialog', () => ({
  Dialog: ({ children }: any) => children,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}));

describe('select menus inside raised dialogs', () => {
  it('places menus above the custom calculation dialog', () => {
    const html = renderToStaticMarkup(<SettingsDialog open onOpenChange={() => {}} title="Calcul personnalisé" layer={450}>
      <SelectContent>Options</SelectContent>
    </SettingsDialog>);
    expect(html).toContain('z-index:451');
  });
  it('preserves the normal menu layer outside raised dialogs', () => {
    const html = renderToStaticMarkup(<SelectContent>Options</SelectContent>);
    expect(html).toContain('z-[401]');
    expect(html).not.toContain('z-index:451');
  });
  it('supports higher dialogs and preserves explicit per-menu overrides', () => {
    const html = renderToStaticMarkup(<SelectLayerContext.Provider value={601}><SelectContent>Options</SelectContent></SelectLayerContext.Provider>);
    expect(html).toContain('z-index:601');
    const overridden = renderToStaticMarkup(<SelectLayerContext.Provider value={451}><SelectContent style={{ zIndex: 700 }}>Options</SelectContent></SelectLayerContext.Provider>);
    expect(overridden).toContain('z-index:700');
  });
});
