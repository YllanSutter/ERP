import { GLOBAL_DATE_PRESET_LABELS, type ModulePeriod } from '@/lib/dashboardTypes';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  value?: ModulePeriod;
  onChange: (period: ModulePeriod | undefined) => void;
  inherit?: boolean;
}

export default function ModulePeriodSelect({ value, onChange, inherit = false }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value?.preset ?? (inherit ? 'inherit' : 'all')} onValueChange={(preset) =>
        onChange(preset === 'inherit' ? undefined : { preset: preset as ModulePeriod['preset'] })}>
        <SelectTrigger aria-label={inherit ? 'Période de cet élément' : 'Période générale du layout'} className="h-8 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {inherit && <SelectItem value="inherit">Période du layout</SelectItem>}
          <SelectItem value="all">Toutes les dates</SelectItem>
          {Object.entries(GLOBAL_DATE_PRESET_LABELS).map(([preset, label]) =>
            <SelectItem key={preset} value={preset}>{label}</SelectItem>)}
        </SelectContent>
      </Select>
      {value?.preset === 'custom' && (
        <>
          <Input type="date" aria-label="Début de période" className="h-8 w-auto text-xs" value={value.start ?? ''}
            max={value.end} onChange={(event) => onChange({ ...value, start: event.target.value || undefined })} />
          <Input type="date" aria-label="Fin de période" className="h-8 w-auto text-xs" value={value.end ?? ''}
            min={value.start} onChange={(event) => onChange({ ...value, end: event.target.value || undefined })} />
        </>
      )}
    </div>
  );
}
