import React from 'react';

export const SelectOptionsContext = React.createContext<{
  collections: any[];
  setCollections: React.Dispatch<React.SetStateAction<any[]>>;
} | null>(null);

