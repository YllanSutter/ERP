import React, { useState } from 'react';
import CollectionFilterPanel from './CollectionFilterPanel';
import WeekView from '../CalendarView/WeekView';

interface CalendarCollectionsManagerProps {
  collections: any[];
  defaultDuration?: number;
  startHour?: number;
  endHour?: number;
}

const CalendarCollectionsManager: React.FC<CalendarCollectionsManagerProps> = ({
  collections,
  defaultDuration = 1,
  startHour = 8,
  endHour = 20,
}) => {
  // État des filtres et du champ date par collection
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [dateFields, setDateFields] = useState<Record<string, string>>({});

  // Filtrage des items par collection
  const getFilteredItems = (collection: any) => {
    const filter = filters[collection.id] || {};
    const dateFieldId = dateFields[collection.id];
    const dateField = collection.properties.find((p: any) => p.id === dateFieldId);
    let items = collection.items || [];
    // Filtrage par champ
    items = items.filter((item: any) => {
      // Pour chaque filtre actif
      for (const fieldId in filter) {
        const field = collection.properties.find((p: any) => p.id === fieldId);
        if (!field) continue;
        const value = item[fieldId];
        const filterValue = filter[fieldId];
        if (!filterValue) continue;
        if (field.type === 'select') {
          if (value !== filterValue) return false;
        } else {
          if (typeof value === 'string' && !value.toLowerCase().includes(filterValue.toLowerCase())) return false;
        }
      }
      return true;
    });
    // Ajoute la référence collection à chaque item
    return items.map((item: any) => ({ ...item, __collectionId: collection.id }));
  };

  // Rendu des panneaux de filtre et du calendrier
  return (
    <div>
        <div className='grid grid-cols-2'>
        {collections.map((collection) => (
            <CollectionFilterPanel
              key={collection.id}
              collection={collection}
              properties={collection.properties}
              filters={filters[collection.id] || {}}
              setFilters={(f: any) => setFilters((prev) => ({ ...prev, [collection.id]: f }))}
              dateField={dateFields[collection.id]}
              setDateField={(fieldId: string) => setDateFields((prev) => ({ ...prev, [collection.id]: fieldId }))}
              collections={collections}
            />
        ))}
        </div>
      <WeekView
              currentDate={new Date()}
              items={collections.flatMap(getFilteredItems)}
              collections={collections}
              getNameValue={(item) => {
                  const col = collections.find(c => c.id === item.__collectionId);
                  if (!col) return item.name || 'Sans titre';
                  const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
                  return nameField ? item[nameField.id] : item.name || 'Sans titre';
              } }
              getItemsForDate={(date) => {
                  // Regroupe les items filtrés de toutes les collections pour une date donnée
                  return collections.flatMap(col => {
                      const dateFieldId = dateFields[col.id];
                      const dateField = col.properties.find((p: any) => p.id === dateFieldId);
                      return getFilteredItems(col).filter((item: { [x: string]: any; }) => {
                          if (!dateField) return false;
                          const value = item[dateField.id];
                          if (!value) return false;
                          if (dateField.type === 'date') {
                              const itemDate = new Date(value).toISOString().split('T')[0];
                              const dateStr = date.toISOString().split('T')[0];
                              return itemDate === dateStr;
                          } else if (dateField.type === 'date_range') {
                              if (typeof value === 'object' && value.start && value.end) {
                                  const start = new Date(value.start).toISOString().split('T')[0];
                                  const end = new Date(value.end).toISOString().split('T')[0];
                                  const dateStr = date.toISOString().split('T')[0];
                                  return dateStr >= start && dateStr <= end;
                              }
                          }
                          return false;
                      });
                  });
              } }
              getDateFieldForItem={(item) => {
                  const col = collections.find(c => c.id === item.__collectionId);
                  if (!col) return undefined;
                  const dateFieldId = dateFields[col.id];
                  return col.properties.find((p: any) => p.id === dateFieldId);
              } }
              onDelete={() => { } }
              onEdit={() => { } }
              onViewDetail={() => { } }
              defaultDuration={defaultDuration}
              startHour={startHour}
              endHour={endHour} 
            />
    </div>
  );
};

export default CalendarCollectionsManager;
