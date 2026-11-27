import React, { useState } from 'react';
import { FormField, FormCheckbox, FormHint, FormInput, FormNameInput, DeleteConfirmButton } from '@/components/ui/ModalWrapper';
import { Button } from '@/components/ui/button';
import { SettingsSheet, SettingsTabs, SettingsTabContent, SettingsFooter } from '@/components/ui/settings-panel';
import EditableProperty from '@/components/fields/EditableProperty';
import { toLocalDateInputValue, toTimeInputValue } from '@/lib/collectionTemplateDates';
import * as Icons from 'lucide-react';
import HistoryPanel from '@/components/history/HistoryPanel';

interface EditCollectionModalProps {
  onClose: () => void;
  onSave: (collection: any) => void;
  onDelete: (collectionId: string) => void;
  collection: any;
  collections?: any[];
  onAddField?: (collectionId: string) => void;
  renderPluginSettings?: (collection: any, onChange: (changes: any) => void) => React.ReactNode;
}

const EditCollectionModal: React.FC<EditCollectionModalProps> = ({ onClose, onSave, onDelete, collection, collections = [], onAddField, renderPluginSettings }) => {
  const [pluginChanges, setPluginChanges] = useState<Record<string, any>>({});
  const [name, setName] = useState(collection.name);
  const [icon, setIcon] = useState(collection.icon || 'Database');
  const [color, setColor] = useState(collection.color || '#8b5cf6');
  const [isPrimary, setIsPrimary] = useState(!!collection.isPrimary);
  const [defaultVisibleFieldIds, setDefaultVisibleFieldIds] = useState<string[]>(() => {
    const props = collection.properties || [];
    if (Array.isArray(collection.defaultVisibleFieldIds) && collection.defaultVisibleFieldIds.length) {
      return collection.defaultVisibleFieldIds;
    }
    return props[0] ? [props[0].id] : [];
  });
  const [collectionTemplates, setCollectionTemplates] = useState<any[]>(() =>
    Array.isArray(collection.collectionTemplates) ? collection.collectionTemplates : []
  );
  const [activeTemplateId, setActiveTemplateId] = useState(() => collection.collectionTemplates?.[0]?.id || '');
  const [activeTab, setActiveTab] = useState('general');

  const handleSave = () => {
    const props = collection.properties || [];
    const normalizedDefaultVisible = defaultVisibleFieldIds.length
      ? defaultVisibleFieldIds
      : (props[0] ? [props[0].id] : []);
    onSave({ ...collection, ...pluginChanges, name, icon, color, isPrimary, defaultVisibleFieldIds: normalizedDefaultVisible, collectionTemplates });
  };

  const updateTemplate = (index: number, changes: Record<string, any>) => {
    setCollectionTemplates(previous => previous.map((template, templateIndex) =>
      templateIndex === index ? { ...template, ...changes } : template
    ));
  };

  const updateTemplateValue = (index: number, fieldId: string, value: any) => {
    setCollectionTemplates(previous => previous.map((template, templateIndex) => templateIndex === index
      ? { ...template, values: { ...(template.values || {}), [fieldId]: value } }
      : template
    ));
  };

  const updateTemplateDateParts = (index: number, fieldId: string, parts: Record<string, any>) => {
    setCollectionTemplates(previous => previous.map((template, templateIndex) => templateIndex === index
      ? { ...template, dateDefaults: { ...(template.dateDefaults || {}), [fieldId]: parts } }
      : template
    ));
  };

  const addTemplate = () => {
    const template = { id: `collection_tpl_${Date.now()}`, name: '', fieldIds: [], values: {} };
    setCollectionTemplates(previous => [...previous, template]);
    setActiveTemplateId(template.id);
  };

  const addField = () => {
    handleSave();
    onAddField?.(collection.id);
  };

  return (
    <SettingsSheet open wide onOpenChange={open => { if (!open) onClose(); }}
      title="Modifier la collection" description={name || collection.name} icon={Icons.Database}>
      <SettingsTabs value={activeTab} onValueChange={setActiveTab} label="Paramètres de la collection" navigation="sidebar"
        items={[
          { id: 'general', label: 'Général', icon: Icons.Settings2 },
          { id: 'fields', label: 'Champs', icon: Icons.List },
          { id: 'templates', label: 'Templates', icon: Icons.Sparkles },
          ...(renderPluginSettings ? [{ id: 'plugins', label: 'Plugins', icon: Icons.Plug }] : []),
          { id: 'history', label: 'Historique', icon: Icons.History, bottom: true },
        ]}>
        <SettingsTabContent value="general" scrollable>
          <div className="space-y-5">
            <FormNameInput label="Nom" value={name} onChange={setName} icon={icon} onIconChange={setIcon}
              color={color} onColorChange={setColor} placeholder="Nom de la collection" />
            <div>
              <FormCheckbox label="Collection principale" checked={isPrimary} onChange={setIsPrimary} />
              <FormHint className="mt-1 ml-6">Utilisée en priorité pour les créations rapides, par exemple depuis le calendrier.</FormHint>
            </div>
          </div>
        </SettingsTabContent>
        <SettingsTabContent value="fields" scrollable>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Champs de la collection</h3>
              <p className="mt-1 text-xs text-muted-foreground">Ajoute ou configure les propriétés disponibles dans cette collection.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addField}>
              <Icons.Plus size={14} /> Ajouter un champ
            </Button>
          </div>
          <FormField label="Champs visibles par défaut" hint="Ces champs seront visibles lors de la création d'une nouvelle vue.">
            <div className="space-y-2 rounded-lg border border-border p-3">
              {(collection.properties || []).map((prop: any, idx: number) => (
                <FormCheckbox key={prop.id}
                  label={<>{prop.name}{idx === 0 && <span className="ml-1 text-xs text-muted-foreground">(par défaut)</span>}</>}
                  checked={defaultVisibleFieldIds.includes(prop.id)}
                  onChange={checked => {
                    const next = checked ? Array.from(new Set([...defaultVisibleFieldIds, prop.id])) : defaultVisibleFieldIds.filter(id => id !== prop.id);
                    setDefaultVisibleFieldIds(next.length ? next : (collection.properties?.[0] ? [collection.properties[0].id] : []));
                  }} />
              ))}
              {(collection.properties || []).length === 0 && <div className="text-xs text-muted-foreground">Aucun champ.</div>}
            </div>
          </FormField>
        </SettingsTabContent>
        <SettingsTabContent value="templates" scrollable>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">Les champs cochés seront affichés dans la fiche. Leur valeur utilise l’éditeur correspondant au type du champ.</div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addTemplate}>
                <Icons.Plus size={14} /> Ajouter
              </Button>
            </div>
            {collectionTemplates.length > 0 ? (
              <SettingsTabs value={activeTemplateId} onValueChange={setActiveTemplateId} label="Templates de collection" appearance="underline"
                items={collectionTemplates.map((template, index) => ({ id: template.id, label: template.name?.trim() || `Template ${index + 1}`, icon: Icons.Sparkles }))}>
                {collectionTemplates.map((template, index) => {
                  const fieldIds = Array.isArray(template.fieldIds) ? template.fieldIds : [];
                  const values = template.values && typeof template.values === 'object' ? template.values : {};
                  return <SettingsTabContent key={template.id || index} value={template.id} scrollable>
                    <section className="overflow-hidden rounded-xl border border-border">
                      <div className="flex items-center gap-2 border-b border-border p-3">
                        <FormInput aria-label={`Nom du template ${index + 1}`} value={template.name || ''} placeholder={`Template ${index + 1}`}
                          onChange={event => updateTemplate(index, { name: event.target.value })} />
                        <Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => {
                          const next = collectionTemplates.filter((_, i) => i !== index);
                          setCollectionTemplates(next);
                          setActiveTemplateId(next[Math.max(0, index - 1)]?.id || '');
                        }}>Supprimer</Button>
                      </div>
                      <div className="max-h-[55vh] space-y-2 overflow-y-auto p-3">
                        {(collection.properties || []).map((prop: any) => {
                          const included = fieldIds.includes(prop.id);
                          const updateFieldList = (checked: boolean) => {
                            const next = checked ? Array.from(new Set([...fieldIds, prop.id])) : fieldIds.filter((id: string) => id !== prop.id);
                            const nextValues = { ...values };
                            const nextDateDefaults = { ...(template.dateDefaults || {}) };
                            if (!checked) {
                              delete nextValues[prop.id];
                              delete nextValues[`${prop.id}_duration`];
                              delete nextDateDefaults[prop.id];
                            }
                            updateTemplate(index, { fieldIds: next, values: nextValues, dateDefaults: nextDateDefaults });
                          };
                          const currentValue = values[prop.id] ?? (['multiselect', 'multi_select'].includes(prop.type) ? [] : prop.type === 'checkbox' || prop.type === 'boolean' ? false : '');
                          const savedDateParts = template.dateDefaults?.[prop.id];
                          const dateParts = savedDateParts || {
                            day: values[prop.id] === 'current_date' ? 'today' : values[prop.id] ? 'fixed' : 'none',
                            fixedDate: toLocalDateInputValue(values[prop.id]),
                            time: toTimeInputValue(values[prop.id]),
                            duration: values[`${prop.id}_duration`] !== undefined && values[`${prop.id}_duration`] !== ''
                              ? Number(values[`${prop.id}_duration`]) : null,
                          };
                          return <div key={prop.id} className="rounded-lg border border-border/70 p-2.5">
                            <FormCheckbox label={<span className="flex items-center gap-2">{prop.name}<span className="text-[10px] text-muted-foreground">{prop.type === 'relation' ? 'Relation' : prop.type}</span></span>}
                              checked={included} onChange={updateFieldList} />
                            {included && prop.type === 'date' && <div className="ml-6 mt-3 space-y-3">
                              <p className="text-xs text-muted-foreground">Choisis les éléments que le template doit préremplir.</p>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <FormCheckbox label="Jour" checked={dateParts.day !== 'none'} onChange={checked => updateTemplateDateParts(index, prop.id, {
                                  ...dateParts, day: checked ? (dateParts.day === 'none' ? 'today' : dateParts.day) : 'none',
                                })} />
                                <FormCheckbox label="Heure de départ" checked={Boolean(dateParts.time)} onChange={checked => updateTemplateDateParts(index, prop.id, {
                                  ...dateParts, time: checked ? (dateParts.time || '09:00') : '',
                                })} />
                                <FormCheckbox label="Durée" checked={dateParts.duration !== null && dateParts.duration !== undefined} onChange={checked => updateTemplateDateParts(index, prop.id, {
                                  ...dateParts, duration: checked ? (dateParts.duration ?? 1) : null,
                                })} />
                              </div>
                              {dateParts.day !== 'none' && <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" size="sm" variant={dateParts.day === 'today' ? 'default' : 'outline'} onClick={() => updateTemplateDateParts(index, prop.id, { ...dateParts, day: 'today' })}>Aujourd'hui, à l'application</Button>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>Jour fixe</span>
                                  <input type="date" value={dateParts.day === 'fixed' ? (dateParts.fixedDate || '') : ''}
                                    onChange={event => updateTemplateDateParts(index, prop.id, { ...dateParts, day: 'fixed', fixedDate: event.target.value })}
                                    className="rounded-md border border-border bg-background px-2 py-1.5 text-foreground" />
                                </label>
                              </div>}
                              {Boolean(dateParts.time) && <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                Heure de départ
                                <input type="time" value={dateParts.time} onChange={event => updateTemplateDateParts(index, prop.id, { ...dateParts, time: event.target.value })}
                                  className="rounded-md border border-border bg-background px-2 py-1.5 text-foreground" />
                              </label>}
                              {dateParts.duration !== null && dateParts.duration !== undefined && <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                Durée
                                <select value={String(dateParts.duration)} onChange={event => updateTemplateDateParts(index, prop.id, { ...dateParts, duration: Number(event.target.value) })}
                                  className="max-h-40 overflow-y-auto rounded-md border border-border bg-background px-2 py-1.5 text-foreground">
                                  {Array.from({ length: 97 }, (_, valueIndex) => valueIndex / 4).map(duration => {
                                    const label = `${String(Math.floor(duration)).padStart(2, '0')}:${String((duration % 1) * 60).padStart(2, '0')}`;
                                    return <option key={duration} value={duration}>{label}</option>;
                                  })}
                                </select>
                              </label>}
                            </div>}
                            {included && prop.type !== 'date' && <div className="ml-6 mt-2">
                              <EditableProperty property={prop} value={currentValue}
                                onChange={value => updateTemplateValue(index, prop.id, value)}
                                onRelationChange={(_property: any, updatedItem: any, value: any) => {
                                  updateTemplateValue(index, prop.id, value);
                                }}
                                collections={collections} collection={collection} currentItem={values} size="sm" forceRichEditor />
                            </div>}
                          </div>;
                        })}
                        {(collection.properties || []).length === 0 && <div className="text-xs text-muted-foreground">Ajoute d’abord des champs à cette collection.</div>}
                      </div>
                    </section>
                  </SettingsTabContent>;
                })}
              </SettingsTabs>
            ) : <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Aucun template. Ajoute un template pour définir les champs affichés et leurs valeurs.</div>}
          </div>
        </SettingsTabContent>
        {renderPluginSettings && <SettingsTabContent value="plugins" scrollable>
          {renderPluginSettings({ ...collection, ...pluginChanges }, changes => setPluginChanges(previous => ({ ...previous, ...changes })))}
        </SettingsTabContent>}
        <SettingsTabContent value="history" scrollable className="p-0">
          <HistoryPanel collectionId={collection.id} title={`Historique · ${collection.name || 'Collection'}`} />
        </SettingsTabContent>
      </SettingsTabs>
      <SettingsFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <DeleteConfirmButton onDelete={() => onDelete(collection.id)} title="Supprimer la collection" />
        <Button type="button" size="sm" onClick={handleSave}>Enregistrer</Button>
      </SettingsFooter>
    </SettingsSheet>
  );
};

export default EditCollectionModal;
