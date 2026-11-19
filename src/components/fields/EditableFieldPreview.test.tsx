import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EditableFieldPreview from './EditableFieldPreview';
import EditableProperty from './EditableProperty';
import { SelectPropertyField } from './SelectPropertyField';

vi.mock('./EditableProperty', () => ({ default: () => null }));

const property = { id: 'notes', name: 'Notes', type: 'rich_text' };

describe('editable compact previews', () => {
  it('preserves the preview and exposes a keyboard accessible editor trigger', () => {
    const html = renderToStaticMarkup(<EditableFieldPreview property={property} value="Texte" onChange={vi.fn()}>Texte</EditableFieldPreview>);
    expect(html).toContain('Modifier Notes');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('Texte');
    expect(html).not.toContain('textarea');
  });

  it('passes edits and relation actions to the existing field editor', () => {
    const onChange = vi.fn();
    const onRelationChange = vi.fn();
    const currentItem = { id: '1', notes: 'Avant' };
    const tree = EditableFieldPreview({ property, value: 'Avant', onChange, onRelationChange, currentItem, children: 'Avant' });
    const content = React.Children.toArray(tree.props.children)[1] as React.ReactElement<any>;
    const editor = React.Children.toArray(content.props.children).find((child: any) => child.type === EditableProperty) as React.ReactElement<any>;
    expect(editor.props.forceRichEditor).toBe(true);
    expect(editor.props.currentItem).toBe(currentItem);
    expect(editor.props.onRelationChange).toBe(onRelationChange);
    editor.props.onChange('Après');
    expect(onChange).toHaveBeenCalledWith('Après');
  });

  it.each([
    { property, readOnly: true },
    { property: { id: 'total', name: 'Total', type: 'number', numberMode: 'calculated' } },
  ])('keeps restricted or calculated fields as previews', (props) => {
    const html = renderToStaticMarkup(<EditableFieldPreview {...props} value="Valeur" onChange={vi.fn()}>Valeur</EditableFieldPreview>);
    expect(html).toBe('Valeur');
  });
});

it.each(['select', 'multi_select', 'multiselect'])('opens %s directly from the compact preview', type => {
  const onChange = vi.fn();
  const tree = EditableFieldPreview({ property: { id: 'status', name: 'Reçu ?', type },
    value: 'Oui', onChange, collection: { id: 'purchases' } as any, children: 'Oui' });
  expect(tree.type).toBe(SelectPropertyField);
  expect(tree.props.collectionId).toBe('purchases');
  expect(tree.props.onChange).toBe(onChange);
  expect(tree.props.trigger.props['aria-label']).toBe('Modifier Reçu ?');
  expect(renderToStaticMarkup(tree.props.trigger)).toContain('Oui');
});
