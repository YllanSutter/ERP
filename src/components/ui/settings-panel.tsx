import { SelectLayerContext } from './select-layer';
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { X, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { PopoverContent, PopoverClose } from './popover';
import { Switch } from './switch';
import { IconButton } from './icon-button';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import './settings-panel.css';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarRail } from './sidebar';

interface HeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  onClose?: () => void;
  titleComponent?: React.ElementType;
  descriptionComponent?: React.ElementType;
}

export function SettingsHeader({ title, description, icon: Icon, actions, onClose, titleComponent: Title = 'h2', descriptionComponent: Description = 'p' }: HeaderProps) {
  return (
    <header className="settings-header">
      {Icon && <span className="settings-header-icon"><Icon size={16} aria-hidden="true" /></span>}
      <div className="min-w-0 flex-1">
        <Title className="settings-title">{title}</Title>
        {description && <Description className="settings-description">{description}</Description>}
      </div>
      {actions}
      {onClose && <IconButton className="settings-dismiss" label="Fermer les paramètres" onClick={onClose}><X size={16} /></IconButton>}
    </header>
  );
}

interface WindowProps extends Omit<HeaderProps, 'onClose' | 'titleComponent' | 'descriptionComponent'> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSheet({ open, onOpenChange, title, description, icon, actions, children, className, wide = false, nested = false }: WindowProps & { wide?: boolean; nested?: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" overlayClassName={nested ? 'z-[309] bg-transparent' : 'z-[299] bg-transparent'}
        className={cn('settings-surface flex w-full flex-col gap-0 overflow-hidden p-0', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg', nested ? 'z-[310]' : 'z-[300]', className)}>
        <SettingsHeader title={title} description={description} icon={icon} actions={actions} titleComponent={SheetTitle} descriptionComponent={SheetDescription} />
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function SettingsDialog({ open, onOpenChange, title, description, icon, actions, children, className, workspace = false, layer }: WindowProps & { workspace?: boolean; layer?: number }) {
  return (
    <SelectLayerContext.Provider value={Math.max(401, (layer ?? 300) + 1)}>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={layer === undefined ? undefined : { zIndex: layer }} overlayStyle={layer === undefined ? undefined : { zIndex: layer }}
        className={cn('settings-surface flex max-h-[90dvh] w-[calc(100%_-_1rem)] flex-col gap-0 overflow-hidden p-0',
        workspace ? 'h-[100dvh] max-h-[100dvh] max-w-none sm:h-[min(850px,92dvh)] sm:w-[calc(100%_-_2rem)] sm:max-w-6xl sm:rounded-2xl' : 'sm:max-w-2xl', className)}>
        <SettingsHeader title={title} description={description} icon={icon} actions={actions} titleComponent={DialogTitle} descriptionComponent={DialogDescription} />
        {!description && <DialogDescription className="sr-only">Paramètres</DialogDescription>}
        {children}
      </DialogContent>
    </Dialog>
    </SelectLayerContext.Provider>
  );
}

export function SettingsPopoverContent({ title, description, children, className, ...props }: Omit<React.ComponentProps<typeof PopoverContent>, 'title'> & { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <PopoverContent className={cn('settings-surface w-[min(90vw,26rem)] overflow-hidden p-0', className)} {...props}>
      <SettingsHeader title={title} description={description} actions={
        <PopoverClose asChild><IconButton className="settings-dismiss" label="Fermer les paramètres"><X size={16} /></IconButton></PopoverClose>
      } />
      {children}
    </PopoverContent>
  );
}

export function SettingsFrame({ children, asChild = false, embedded = false, raised = false }: { children: React.ReactNode; asChild?: boolean; embedded?: boolean; raised?: boolean }) {
  const Component = asChild ? Slot : 'div';
  return <Component className={cn('settings-surface settings-frame', embedded ? 'settings-frame-embedded' : 'settings-frame-sidebar', raised && 'settings-frame-raised')}>{children}</Component>;
}

export function SettingsBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('settings-body', className)} {...props} />;
}

export function SettingsFooter({ className, spread = false, ...props }: React.HTMLAttributes<HTMLElement> & { spread?: boolean }) {
  return <footer data-spread={spread} className={cn('settings-footer', className)} {...props} />;
}

export interface SettingsTab {
  id: string;
  label: string;
  icon?: React.ElementType;
}

export function SettingsTabs({ items, value, onValueChange, children, navigation = 'top', label = 'Sections des paramètres', inline = false, defaultValue, appearance = 'default' }: {
  appearance?: 'default' | 'underline';
  items: readonly SettingsTab[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  inline?: boolean;
  navigation?: 'top' | 'side' | 'sidebar';
  label?: string;
}) {
  const mobile = useIsMobile();
  const side = navigation === 'side';
  if (navigation === 'sidebar' && !mobile) {
    return (
      <Tabs value={value} defaultValue={defaultValue} onValueChange={onValueChange} orientation="vertical" className="settings-tabs settings-tabs-app-sidebar">
        <SidebarProvider persistState={false} shortcutEnabled={false} className="relative !min-h-0 min-w-0 flex-1 overflow-hidden" style={{ '--sidebar-width': '11rem' } as React.CSSProperties}>
          <Sidebar collapsible="icon" className="!absolute !h-full">
            <SidebarHeader><SidebarTrigger title="Réduire ou déployer les onglets" aria-label="Réduire ou déployer les onglets" /></SidebarHeader>
            <SidebarContent>
              <TabsList asChild>
                <SidebarMenu aria-label={label} className="!h-auto !items-stretch !justify-start !rounded-none !border-0 !bg-transparent !p-2">
                  {items.map(({ id, label: title, icon: Icon }) => (
                    <SidebarMenuItem key={id}>
                      <TabsTrigger value={id} asChild>
                        <SidebarMenuButton tooltip={{ children: title, className: 'z-[450]' }} isActive={value === id} className="!justify-start data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground">
                          {Icon && <Icon size={14} aria-hidden="true" />}<span>{title}</span>
                        </SidebarMenuButton>
                      </TabsTrigger>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </TabsList>
            </SidebarContent>
            <SidebarRail />
          </Sidebar>
          <div className="settings-tab-panels">{children}</div>
        </SidebarProvider>
      </Tabs>
    );
  }
  return (
    <Tabs value={value} defaultValue={defaultValue} onValueChange={onValueChange} orientation={side && !mobile ? 'vertical' : 'horizontal'}
      className={cn('settings-tabs', side && 'settings-tabs-side', inline && 'settings-tabs-inline', appearance === 'underline' && 'settings-tabs-underline')}>
      <nav className="settings-navigation">
        <TabsList aria-label={label} className="settings-tabs-list">
          {items.map(({ id, label: title, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="settings-tab-trigger">
              {Icon && <Icon size={14} aria-hidden="true" />}{title}
            </TabsTrigger>
          ))}
        </TabsList>
      </nav>
      <div className="settings-tab-panels">{children}</div>
    </Tabs>
  );
}

export function SettingsTabContent({ className, scrollable = false, ...props }: React.ComponentProps<typeof TabsContent> & { scrollable?: boolean }) {
  return <TabsContent data-scrollable={scrollable} className={cn('settings-body settings-tab-content', className)} {...props} />;
}

export function SettingsSectionTitle({ className, ruled = false, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { ruled?: boolean }) {
  return <h3 className={cn('settings-section-title', ruled && 'settings-section-title-ruled', className)} {...props} />;
}

export function SettingsSection({ title, icon: Icon, children, className, action, hideHeader = false, appearance = 'default', ruled = false }: { title: React.ReactNode; icon?: LucideIcon; children: React.ReactNode; className?: string; action?: React.ReactNode; hideHeader?: boolean; appearance?: 'default' | 'plain'; ruled?: boolean }) {
  return (
    <section data-appearance={appearance} className={cn('settings-section', className)}>
      {!hideHeader && <SettingsSectionTitle ruled={ruled} className="settings-section-header">{Icon && <Icon size={15} aria-hidden="true" />}<span className="min-w-0 flex-1">{title}</span>{action}</SettingsSectionTitle>}
      <div className="settings-section-body">{children}</div>
    </section>
  );
}

export function SettingsLabel({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('settings-label', className)} {...props} />;
}

export function SettingsHint({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('settings-hint', className)} {...props} />;
}

export function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <SettingsLabel>{label}</SettingsLabel>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export interface SettingsSelectOption {
  value: string;
  label: string;
  icon?: React.ElementType;
  disabled?: boolean;
}

export interface SettingsSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: readonly SettingsSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

const EMPTY_OPTION = '__settings_empty__';

export function SettingsSelect({ value, onChange, options, placeholder, className, disabled, 'aria-label': ariaLabel }: SettingsSelectProps) {
  const selectedValue = String(value ?? '');
  const choices = placeholder && !options.some(({ value }) => value === '') ? [{ value: '', label: placeholder }, ...options] : options;
  const selected = choices.find(({ value }) => value === selectedValue);
  const Icon = selected?.icon;
  return (
    <Select value={selectedValue || EMPTY_OPTION} onValueChange={(value) => onChange(value === EMPTY_OPTION ? '' : value)} disabled={disabled}>
      <SelectTrigger aria-label={ariaLabel} className={cn('settings-control', className)}>
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {Icon && <Icon size={14} className="shrink-0" aria-hidden="true" />}
          <SelectValue className="min-w-0 truncate">{selected?.label ?? (selectedValue || placeholder)}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {choices.map(({ value, label, icon: OptionIcon, disabled }) => (
          <SelectItem key={value || EMPTY_OPTION} value={value || EMPTY_OPTION} disabled={disabled}>
            <span className="flex min-w-0 items-center gap-2">
              {OptionIcon && <OptionIcon size={14} className="shrink-0" aria-hidden="true" />}
              <span className="min-w-0 truncate">{label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
