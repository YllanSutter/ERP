import { describe, expect, it } from 'vitest';
import { legacyStorageScope } from './legacyStorageScope.js';
describe('legacy ownership', () => {
  it('requires a claim for values without a recorded account owner', () => {
    for (const key of ['erp-theme', 'erp-item-draft:c:new', 'erp_activeCollection_org', 'calendarViewMode', 'erp-item-versions:c:i']) expect(legacyStorageScope(key, 'u', 'org')).toBe('claim');
  });
  it('accepts explicitly matching user pins and shared organization histories', () => {
    expect(legacyStorageScope('erp-pinned-item-fields:org:u:c', 'u', 'org')).toBe('owned');
    expect(legacyStorageScope('erp-item-versions:org:c:i', 'u', 'org')).toBe('owned');
  });
  it('never claims another account or organization, or another application', () => {
    for (const key of ['erp-pinned-item-fields:org:other:c', 'erp-pinned-item-fields:other:u:c', 'erp-item-versions:other:c:i', 'erp_activeCollection_other', 'erp_lastView_other_c', 'other-app']) expect(legacyStorageScope(key, 'u', 'org')).toBe('foreign');
  });
});
