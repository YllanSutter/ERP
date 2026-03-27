import { useState } from 'react';
import ModalWrapper, { FormNameInput } from '@/components/ui/ModalWrapper';

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
      size="sm"
    >
      <FormNameInput
        label="Nom"
        value={name}
        onChange={setName}
        icon={icon}
        onIconChange={setIcon}
        color={color}
        onColorChange={setColor}
        placeholder="Nom de la collection"
        autoFocus
      />
    </ModalWrapper>
  );
};

export default NewCollectionModal;
