import React, { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface Organization {
  id: string;
  name: string;
  [key: string]: any;
}

interface WorkspaceSwitcherProps {
  organizations: Organization[];
  activeOrganizationId: string | null;
  onSwitchOrganization: (organizationId: string) => Promise<void>;
  onCreateOrganization: (name: string) => Promise<void>;
  collapsed?: boolean;
}

function getInitials(name: string): string {
  if (!name) return 'W';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  organizations,
  activeOrganizationId,
  onSwitchOrganization,
  onCreateOrganization,
  collapsed = false,
}) => {
  const [open, setOpen] = useState(false);

  const active = organizations.find((o) => o.id === activeOrganizationId) || organizations[0];
  const initials = active ? getInitials(active.name) : 'W';

  const handleSelect = async (orgId: string) => {
    setOpen(false);
    if (orgId === activeOrganizationId) return;
    try {
      await onSwitchOrganization(orgId);
    } catch (err: any) {
      alert(err?.message || 'Impossible de changer d’organisation');
    }
  };

  const handleCreate = async () => {
    setOpen(false);
    const name = window.prompt('Nom de la nouvelle organisation ?')?.trim();
    if (!name) return;
    try {
      await onCreateOrganization(name);
    } catch (err: any) {
      alert(err?.message || 'Impossible de créer l’organisation');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Changer d'organisation"
          className={cn(
            'w-full flex items-center gap-2.5 rounded-lg border border-border bg-background',
            'hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            collapsed ? 'h-9 px-1 justify-center' : 'h-10 px-2'
          )}
        >
          <div className="w-7 h-7 shrink-0 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-white text-[11px] font-semibold grid place-items-center">
            {active ? initials : <Building2 size={14} />}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[13px] font-semibold leading-none truncate text-foreground">
                  {active?.name || 'Aucune organisation'}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  {organizations.length} workspace{organizations.length > 1 ? 's' : ''}
                </div>
              </div>
              <ChevronsUpDown size={14} className="text-muted-foreground shrink-0" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[260px] p-0"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder="Rechercher une organisation..." />
          <CommandList>
            <CommandEmpty>Aucune organisation trouvée.</CommandEmpty>
            <CommandGroup heading="Organisations">
              {organizations.map((org) => {
                const isActive = org.id === activeOrganizationId;
                return (
                  <CommandItem
                    key={org.id}
                    value={org.name}
                    onSelect={() => handleSelect(org.id)}
                    className="cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-brand-700 text-white text-[10px] font-semibold grid place-items-center">
                      {getInitials(org.name)}
                    </div>
                    <span className="truncate">{org.name}</span>
                    {isActive && <Check size={14} className="ml-auto text-brand-600" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem onSelect={handleCreate} className="cursor-pointer">
                <Plus size={14} />
                <span>Nouvelle organisation</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default WorkspaceSwitcher;
