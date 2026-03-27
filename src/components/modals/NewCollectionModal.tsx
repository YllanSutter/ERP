import React, { useState } from 'react';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import ModalWrapper, { FormField, FormInput } from '@/components/ui/ModalWrapper';

interface NewCollectionModalProps {
  onClose: () => void;
  onSave: (name: string, icon: string, color: string) => void;
}

const NewCollectionModal: React.FC<NewCollectionModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [color, setColor] = useState('#8b5cf6');

  return (
    <ModalWrapper
      title="Nouvelle collection"
      onClose={onClose}
      onSave={() => { if (name) onSave(name, icon, color); }}
      saveLabel="Créer"
    >
      <div className="space-y-6">
        <FormField label="Nom">
          <FormInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la collection"
          />
        </FormField>
        <FormField label="Icône">
          <IconPicker value={icon} onChange={setIcon} />
        </FormField>
        <FormField label="Couleur">
          <ColorPicker value={color} onChange={setColor} />
        </FormField>
      </div>
    </ModalWrapper>
  );
};

export default NewCollectionModal;
