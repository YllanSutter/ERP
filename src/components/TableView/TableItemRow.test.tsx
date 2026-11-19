import React from 'react';
import { expect, it, vi } from 'vitest';
import TableItemRow from './TableItemRow';
import EditableProperty from '@/components/fields/EditableProperty';
const notes = { id:'notes',name:'Commentaire',type:'rich_text' as const,showContextMenu:true };
const item = {id:'i',name:'Fiche',notes:''};
function editGroup() {
  const renderRow = (TableItemRow as unknown as { type: React.FC<React.ComponentProps<typeof TableItemRow>> }).type;
  const tree = renderRow({item, visibleProperties:[notes], canEdit:true,canEditField:()=>true,
    onEdit:vi.fn(),onDelete:vi.fn(),onToggleFavoriteItem:vi.fn(),onViewDetail:vi.fn(),collections:[],onRelationChange:vi.fn(),onNavigateToCollection:vi.fn(),
    collection:{id:'c',properties:[notes],items:[item]}, animate:false});
  const nodes: React.ReactElement<any>[] = [];
  const visit = (node: React.ReactNode) => React.Children.forEach(node, child => {if(React.isValidElement(child)){nodes.push(child);visit((child.props as any).children);}});
  visit(tree);
  return {group:nodes.find(node=>node.props['aria-label']==='Modifier Commentaire')!,nodes};
}
it('mounts the rich editor in a form group outside menu-item focus management', () => {
  const {group,nodes} = editGroup();
  expect(group.type).toBe('div');expect(group.props.role).toBe('group');
  const editor=nodes.find(node=>node.type===EditableProperty && node.props.property===notes)!;
  expect(editor.props.forceRichEditor).toBe(true);
});
it.each(['a',' ','Enter','ArrowLeft','ArrowDown','Tab'])('keeps %s within the editor instead of triggering menu navigation', key => {
  const event={key,stopPropagation:vi.fn(),preventDefault:vi.fn()};
  editGroup().group.props.onKeyDown(event);
  expect(event.stopPropagation).toHaveBeenCalledOnce();
  expect(event.preventDefault).not.toHaveBeenCalled();
});
it('lets Escape reach the menu and prevents pointer movement from stealing editor focus', () => {
  const group=editGroup().group;const event={key:'Escape',stopPropagation:vi.fn()};
  group.props.onKeyDown(event);expect(event.stopPropagation).not.toHaveBeenCalled();
  group.props.onPointerMove(event);expect(event.stopPropagation).toHaveBeenCalledOnce();
});
