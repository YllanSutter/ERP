import { expect, it } from 'vitest';
import { createSaveCleaner, cleanForSave } from './utils/cleanUtils';
import { applyCalculatedFieldsToCollections } from './calculatedFields';
import { visibleCollections } from './itemArchive';
import { mergeSavedCollections } from './mergeSavedCollections';
import { virtualRange } from './virtualRange';
it('cleans only changed immutable branches while preserving the existing cycle behavior', () => {
  const clean = createSaveCleaner();
  const a = {id:'a',notes:'unchanged'}, b = {id:'b',notes:'before'};
  const source=[{id:'c',items:[a,b]}]; const before=clean(source);
  const after=clean([{...source[0],items:[a,{...b,notes:'after'}]}]);
  expect(after[0].items[0]).toBe(before[0].items[0]);
  expect(after[0].items[1].notes).toBe('after');
  expect(clean(before)).toBe(before);
  const cycle: any={value:1};cycle.self=cycle;
  expect(clean([cycle,cycle])).toEqual(cleanForSave([cycle,cycle]));
});
it('reuses calculated results outside the edited item and invalidates after schema changes', () => {
  const properties=[{id:'a',type:'number'},{id:'b',type:'number'},{id:'sum',type:'number',numberMode:'calculated',calculation:{operation:'add',fieldIds:['a','b']}}];
  const first={id:'c',properties,items:[{id:'1',a:1,b:2},{id:'2',a:10,b:20}]};
  const other={...first,id:'other'};
  const before=applyCalculatedFieldsToCollections(visibleCollections([first,other]));
  const next={...first,items:[{...first.items[0],a:3},first.items[1]]};
  const after=applyCalculatedFieldsToCollections(visibleCollections([next,other]));
  expect(after[0].items[0].sum).toBe(5);
  expect(after[0].items[1]).toBe(before[0].items[1]);expect(after[1]).toBe(before[1]);
  const schema={...next,properties:properties.map(p=>p.id==='sum'?{...p,calculation:{operation:'multiply',fieldIds:['a','b']}}:p)};
  expect(applyCalculatedFieldsToCollections([schema])[0].items[0].sum).toBe(6);
});
it('acknowledging one edited item preserves other item and collection references', () => {
  const a={id:'a',name:'old'}, b={id:'b',name:'unchanged'};
  const col={id:'c',items:[a,b]}, other={id:'other',items:[]};
  const changed={...a,name:'new'};
  const submitted=[col,other]; const local=[{...col,items:[changed,b]},other];
  const saved=[{...col,items:[{...changed},b]},other];
  const merged=mergeSavedCollections(submitted,saved,local);
  expect(merged).toBe(local);expect(merged[0].items![1]).toBe(b);expect(merged[1]).toBe(other);
});
it('bounds a 10000-row window at the beginning, middle and end', () => {
  const offsets=Array.from({length:10001},(_,i)=>i*100);
  for (const top of [0,500000,999550]) {
    const {start,end}=virtualRange(offsets,top,450,200);
    expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeLessThanOrEqual(10000);
    expect(end-start).toBeLessThan(12);
    expect(offsets[start]).toBeLessThanOrEqual(top);
    expect(offsets[end]).toBeGreaterThanOrEqual(Math.min(top+450,1000000));
  }
});

import { groupCalendarMonth } from './calendarMonthGroups';
it('indexes each segment once and keeps distinct collections and multiple segments', () => {
  const first={id:'same',__collectionId:'a',_eventSegments:[{start:'2026-11-19T10:00:00'},{start:'2026-11-19T11:00:00'},{start:'2026-12-01T10:00:00'}]};
  const other={id:'same',__collectionId:'b',_eventSegments:[{start:'2026-11-19T12:00:00'}]};
  const groups=groupCalendarMonth([first,other],2026,10);
  expect(groups.size).toBe(1);expect(groups.get(19)).toHaveLength(2);
  expect(groups.get(19)![0].segments).toHaveLength(2);
  expect(groups.get(19)![0].item).toBe(first);
});
