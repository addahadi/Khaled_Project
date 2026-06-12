import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, ArrowLeft, User, FileText, ChevronDown, CheckCircle } from 'lucide-react';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { labResultsSchema, labResultRowSchema, flattenZodErrors } from '@/api/schemas';
import { useTranslation } from 'react-i18next';

interface ResultRow {
 analyte_name:  string;
 value:  string;
 reference_low: string;
 reference_high: string;
 sub_panel:  string;
 // fallback_flag is only sent when no numeric reference range is provided.
 // When both ref_low and ref_high are filled, the server auto-computes the flag.
 fallback_flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | '';
 result_id?: string;
 is_amended?: boolean;
 original_result_id?: string | null;
}

interface OrderDetail {
 test_id: string;
 test_type: string;
 status: string;
 patient_name: string;
 patient_age: number;
 patient_gender: string;
 medical_history: Record<string, unknown>;
 ordered_by_name: string;
 notes: string;
 results: Array<{
 result_id:  string;
 analyte_name:  string;
 value:  string;
 flag:  string;
 reference_low: string | null;
 reference_high: string | null;
 sub_panel:  string | null;
 is_amended:  boolean;
 original_result_id: string | null;
 acknowledged_at:  string | null;
 unit_symbol:  string;
 }>;
}

const emptyRow = (): ResultRow => ({
 analyte_name: '', value: '', reference_low: '', reference_high: '',
 sub_panel: '', fallback_flag: '',
});

const TEMPLATES: Record<string, ResultRow[]> = {
 'CBC': [
 { analyte_name: 'WBC', value: '', reference_low: '4.5', reference_high: '11.0', sub_panel: 'CBC', fallback_flag: '' },
 { analyte_name: 'RBC', value: '', reference_low: '4.5', reference_high: '5.9', sub_panel: 'CBC', fallback_flag: '' },
 { analyte_name: 'Hemoglobin', value: '', reference_low: '13.5', reference_high: '17.5', sub_panel: 'CBC', fallback_flag: '' },
 { analyte_name: 'Hematocrit', value: '', reference_low: '41', reference_high: '50', sub_panel: 'CBC', fallback_flag: '' },
 { analyte_name: 'Platelets', value: '', reference_low: '150', reference_high: '450', sub_panel: 'CBC', fallback_flag: '' },
 ],
 'BMP': [
 { analyte_name: 'Glucose', value: '', reference_low: '70', reference_high: '99', sub_panel: 'BMP', fallback_flag: '' },
 { analyte_name: 'Calcium', value: '', reference_low: '8.6', reference_high: '10.3', sub_panel: 'BMP', fallback_flag: '' },
 { analyte_name: 'Sodium', value: '', reference_low: '135', reference_high: '145', sub_panel: 'BMP', fallback_flag: '' },
 { analyte_name: 'Potassium', value: '', reference_low: '3.5', reference_high: '5.2', sub_panel: 'BMP', fallback_flag: '' },
 { analyte_name: 'Chloride', value: '', reference_low: '96', reference_high: '106', sub_panel: 'BMP', fallback_flag: '' },
 { analyte_name: 'BUN', value: '', reference_low: '6', reference_high: '20', sub_panel: 'BMP', fallback_flag: '' },
 { analyte_name: 'Creatinine', value: '', reference_low: '0.7', reference_high: '1.3', sub_panel: 'BMP', fallback_flag: '' },
 ],
};

export default function EnterResults() {
  const { t } = useTranslation('lab');
  const { t: c } = useTranslation('common');
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
 const { toast } = useToast();
 const { isLoading, startLoading, stopLoading } = useDelayedLoading();

 const [order, setOrder] = useState<OrderDetail | null>(null);
 const [rows, setRows] = useState<ResultRow[]>([emptyRow()]);
 const [submitting, setSubmitting] = useState(false);
 const [completing, setCompleting] = useState(false);
 const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
 const [amendingRowId, setAmendingRowId] = useState<string | null>(null);

 useEffect(() => {
 if (!testId) return;
 ApiManager.execute({
 queryKey: ['lab', 'orders', testId],
 endpoint: `/lab/orders/${testId}`,
 onStart: startLoading,
 onSuccess: (data: unknown) => {
 const o = (data as { order: OrderDetail }).order;
 setOrder(o);
 if (o.results?.length > 0) {
  setRows(o.results.map(r => ({
  analyte_name:  r.analyte_name,
  value:  r.value,
  reference_low: r.reference_low?.toString() ?? '',
  reference_high: r.reference_high?.toString() ?? '',
  sub_panel:  r.sub_panel ?? '',
  fallback_flag: r.flag as ResultRow['fallback_flag'],
  result_id: r.result_id,
  is_amended: r.is_amended,
  original_result_id: r.original_result_id,
  })));
 }
 },
 onFinal: stopLoading,
 });
 }, [testId, startLoading, stopLoading]);

 const updateRow = (i: number, field: keyof ResultRow, value: string) => {
 setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
 };

 const handleBlur = (i: number) => {
 const row = rows[i];
 // fallback_flag can be empty in our state if unselected, but if schema expects one of enum, handle it
 const rowToParse = { ...row, fallback_flag: row.fallback_flag || undefined };
 const parsed = labResultRowSchema.safeParse(rowToParse);
 
 setFieldErrors(prev => {
 const next = { ...prev };
 // Clear old errors for this row
 Object.keys(next).forEach(k => {
 if (k.startsWith(`results.${i}.`)) delete next[k];
 });
 // Add new errors
 if (!parsed.success) {
 const rowErrors = flattenZodErrors(parsed.error);
 Object.entries(rowErrors).forEach(([k, v]) => {
 next[`results.${i}.${k}`] = v;
 });
 }
 return next;
 });
 };

 const addRow = () => setRows(prev => [...prev, emptyRow()]);
 const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));
 const loadTemplate = (t: string) => setRows(TEMPLATES[t].map(r => ({ ...r })));

 const handleComplete = () => {
  ApiManager.executeMutation({
    mutationFn: () => apiClient.patch(`/lab/orders/${testId}/complete`),
    invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
    onStart: () => setCompleting(true),
    onSuccess: () => {
      toast({ title: t('results.orderCompleted'), description: t('results.orderCompletedDesc') });
      ApiManager.execute({
        queryKey: ['lab', 'orders', testId!],
        endpoint: `/lab/orders/${testId}`,
        onSuccess: (data: unknown) => setOrder((data as { order: OrderDetail }).order)
      });
    },
    onError: ({ message }: { message: string }) => {
      toast({ title: 'Error', description: message, variant: 'destructive' });
    },
    onFinal: () => setCompleting(false)
  });
 };

 const handleAmendSubmit = (i: number) => {
  const row = rows[i];
  if (!row.result_id) return;

  const rowToParse = { ...row, fallback_flag: row.fallback_flag || undefined };
  const parsed = labResultRowSchema.safeParse(rowToParse);
  if (!parsed.success) {
    setFieldErrors(flattenZodErrors(parsed.error));
    toast({ title: t('results.validationError'), description: t('results.validationErrorDesc'), variant: 'destructive' });
    return;
  }
  setFieldErrors({});

  const payload = {
    analyte_name: parsed.data.analyte_name,
    value: parsed.data.value,
    reference_low: parsed.data.reference_low ? Number(parsed.data.reference_low) : undefined,
    reference_high: parsed.data.reference_high ? Number(parsed.data.reference_high) : undefined,
    sub_panel: parsed.data.sub_panel || undefined,
    fallback_flag: (!parsed.data.reference_low && !parsed.data.reference_high && parsed.data.fallback_flag)
      ? parsed.data.fallback_flag
      : undefined,
  };

  ApiManager.executeMutation({
    mutationFn: () => apiClient.post(`/lab/results/${row.result_id}/amend`, payload),
    invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
    onStart: () => setSubmitting(true),
    onSuccess: () => {
      toast({ title: t('results.resultAmended'), description: t('results.resultAmendedDesc') });
      setAmendingRowId(null);
      // Reload order data
      ApiManager.execute({
        queryKey: ['lab', 'orders', testId!],
        endpoint: `/lab/orders/${testId}`,
        onSuccess: (data: unknown) => {
          const o = (data as { order: OrderDetail }).order;
          setOrder(o);
          setRows(o.results.map(r => ({
            analyte_name: r.analyte_name, value: r.value, reference_low: r.reference_low?.toString() ?? '',
            reference_high: r.reference_high?.toString() ?? '', sub_panel: r.sub_panel ?? '',
            fallback_flag: r.flag as any, result_id: r.result_id, is_amended: r.is_amended,
            original_result_id: r.original_result_id
          })));
        }
      });
    },
    onError: ({ message, fields }: { message: string, fields?: Record<string, string> | null }) => {
      toast({ title: 'Error', description: message, variant: 'destructive' });
      if (fields) setFieldErrors(fields);
    },
    onFinal: () => setSubmitting(false),
  });
 };

 const handleSubmit = () => {
 const rowsToParse = rows.map(r => ({
   ...r,
   fallback_flag: r.fallback_flag || undefined
 }));
 const parsed = labResultsSchema.safeParse({ results: rowsToParse });
 if (!parsed.success) {
 setFieldErrors(flattenZodErrors(parsed.error));
 console.log(parsed.error)
 toast({ title: t('results.validationError'), description: t('results.validationErrorDesc'), variant: 'destructive' });
 return;
 }
 setFieldErrors({});

 const payload = {
 test_id: testId,
 results: parsed.data.results.map(r => ({
 analyte_name:  r.analyte_name,
 value:  r.value,
 reference_low:  r.reference_low  ? Number(r.reference_low)  : undefined,
 reference_high: r.reference_high ? Number(r.reference_high) : undefined,
 sub_panel:  r.sub_panel || undefined,
 // Only send fallback_flag when no numeric reference range is supplied.
 // When reference_low + reference_high are present, the server computes
 // the flag automatically and ignores this field.
 fallback_flag: (!r.reference_low && !r.reference_high && r.fallback_flag)
 ? r.fallback_flag
 : undefined,
 })),
 };

 ApiManager.executeMutation({
 mutationFn: () => apiClient.post('/lab/results', payload),
 invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
 onStart: () => setSubmitting(true),
 onSuccess: (_data: unknown, msg: string) => {
 toast({ title: t('results.resultsSubmitted'), description: msg });
 // Reload order data so the tech can review and mark complete
 ApiManager.execute({
   queryKey: ['lab', 'orders', testId!],
   endpoint: `/lab/orders/${testId}`,
   onSuccess: (data: unknown) => {
     const o = (data as { order: OrderDetail }).order;
     setOrder(o);
     setRows(o.results.map(r => ({
       analyte_name: r.analyte_name, value: r.value,
       reference_low: r.reference_low?.toString() ?? '',
       reference_high: r.reference_high?.toString() ?? '',
       sub_panel: r.sub_panel ?? '', fallback_flag: r.flag as ResultRow['fallback_flag'],
       result_id: r.result_id, is_amended: r.is_amended,
       original_result_id: r.original_result_id,
     })));
   },
 });
 },
 onError: ({ message, fields }: { message: string, fields?: Record<string, string> | null }) => {
 toast({ title: 'Error', description: message, variant: 'destructive' });
 if (fields) setFieldErrors(fields);
 },
 onFinal: () => setSubmitting(false),
 });
 };

 if (isLoading) {
 return (
 <div className="space-y-6">
 <Skeleton className="h-8 w-48" />
 <Skeleton className="h-40 w-full" />
 </div>
 );
 }

 if (!order) {
 return <div className="text-center py-12 text-muted-foreground">{t('results.orderNotFound')}</div>;
 }

 const isCompleted = order.status === 'COMPLETED';

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-3">
 <Button variant="ghost" size="icon" onClick={() => navigate('/lab/orders')}>
 <ArrowLeft className="h-4 w-4" />
 </Button>
 <div>
 <h1 className="text-2xl font-semibold text-foreground tracking-tight">
 {isCompleted ? t('results.viewResults') : t('results.enterResults')}
 </h1>
 <p className="text-muted-foreground">{order.test_type}</p>
 </div>
 </div>

 {/* Patient info */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 <User className="h-4 w-4" /> {t('results.patientInfo')}
 </CardTitle>
 </CardHeader>
 <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
 <div><span className="text-muted-foreground">{t('orders.table.patient')}:</span><span className="ml-2 font-medium">{order.patient_name}</span></div>
 <div><span className="text-muted-foreground">{t('results.age')}:</span><span className="ml-2 font-medium">{order.patient_age}</span></div>
 <div><span className="text-muted-foreground">{t('results.gender')}:</span><span className="ml-2 font-medium">{order.patient_gender}</span></div>
 <div><span className="text-muted-foreground">{t('orders.table.testType')}:</span><span className="ml-2 font-medium">{order.test_type}</span></div>
 <div><span className="text-muted-foreground">{t('orders.table.orderedBy')}:</span><span className="ml-2 font-medium">{order.ordered_by_name ?? '—'}</span></div>
 <div>
 <span className="text-muted-foreground">{t('orders.table.status')}:</span>
 <Badge className="ml-2 text-xs" variant={isCompleted ? 'default' : 'outline'}>{order.status}</Badge>
 </div>
 {order.notes && (
 <div className="col-span-3">
 <span className="text-muted-foreground">{t('results.notes')}:</span>
 <span className="ml-2">{order.notes}</span>
 </div>
 )}
 </CardContent>
 </Card>

 {/* Results entry */}
 <Card>
  <CardHeader>
  <CardTitle className="text-base">{t('results.resultEntries')}</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
  {rows.map((row, i) => {
  const hasRefRange = row.reference_low !== '' && row.reference_high !== '';
  const isEditingThisRow = amendingRowId === row.result_id;
  const isRowDisabled = (isCompleted && !isEditingThisRow) || row.is_amended;

  return (
  <div key={row.result_id || i} className={`grid grid-cols-12 gap-2 items-end p-3 border rounded-md relative ${row.is_amended ? 'opacity-60 bg-muted/50 grayscale' : 'bg-muted/20'} ${isEditingThisRow ? 'ring-2 ring-primary/50' : ''}`}>
   
   {/* Status Badges */}
   {(row.is_amended || row.original_result_id) && (
     <div className="absolute -top-2.5 right-4 flex gap-2">
       {row.is_amended && <Badge variant="secondary" className="text-[10px] bg-muted-foreground text-white">{t('results.amended')}</Badge>}
       {row.original_result_id && <Badge className="text-[10px] bg-primary text-primary-foreground">{t('results.corrected')}</Badge>}
     </div>
   )}

  {/* Analyte name */}
 <div className="col-span-12 sm:col-span-2 space-y-1">
  <Label className="text-xs">{t('results.analyteName')}</Label>
  <Input
  placeholder={t('results.placeholders.analyte')}
  value={row.analyte_name}
  onChange={e => updateRow(i, 'analyte_name', e.target.value)}
  onBlur={() => handleBlur(i)}
  disabled={isRowDisabled}
  className={fieldErrors[`results.${i}.analyte_name`] ? 'border-destructive' : row.is_amended ? 'line-through' : ''}
  />
 </div>

 {/* Value */}
 <div className="col-span-6 sm:col-span-2 space-y-1">
  <Label className="text-xs">{t('results.value')}</Label>
  <Input
  placeholder={t('results.placeholders.value')}
  value={row.value}
  onChange={e => updateRow(i, 'value', e.target.value)}
  onBlur={() => handleBlur(i)}
  disabled={isRowDisabled}
  className={fieldErrors[`results.${i}.value`] ? 'border-destructive' : row.is_amended ? 'line-through' : ''}
  />
 </div>

 {/* Ref Low */}
 <div className="col-span-6 sm:col-span-1 space-y-1">
  <Label className="text-xs">{t('results.refLow')}</Label>
  <Input
  type="number" placeholder="0"
  value={row.reference_low}
  onChange={e => updateRow(i, 'reference_low', e.target.value)}
  onBlur={() => handleBlur(i)}
  disabled={isRowDisabled}
  className={fieldErrors[`results.${i}.reference_low`] ? 'border-destructive' : row.is_amended ? 'line-through' : ''}
  />
 </div>

 {/* Ref High */}
 <div className="col-span-6 sm:col-span-1 space-y-1">
  <Label className="text-xs">{t('results.refHigh')}</Label>
  <Input
  type="number" placeholder="100"
  value={row.reference_high}
  onChange={e => updateRow(i, 'reference_high', e.target.value)}
  onBlur={() => handleBlur(i)}
  disabled={isRowDisabled}
  className={fieldErrors[`results.${i}.reference_high`] ? 'border-destructive' : row.is_amended ? 'line-through' : ''}
  />
 </div>

 {/* Sub-panel grouping */}
 <div className="col-span-6 sm:col-span-2 space-y-1">
  <Label className="text-xs">{t('results.subPanel')}</Label>
  <Input
  placeholder={t('results.placeholders.subPanel')}
  value={row.sub_panel}
  onChange={e => updateRow(i, 'sub_panel', e.target.value)}
  onBlur={() => handleBlur(i)}
  disabled={isRowDisabled}
  className={row.is_amended ? 'line-through' : ''}
  />
 </div>

 {/* Flag — auto-computed when ref range is provided, manual otherwise */}
 <div className="col-span-6 sm:col-span-2 space-y-1">
  <Label className="text-xs">
  {t('results.flag')}{' '}
  {hasRefRange && !isRowDisabled && (
  <span className="text-xs font-normal text-primary">({t('results.auto')})</span>
  )}
  </Label>
  {hasRefRange && !isEditingThisRow && !row.fallback_flag ? (
  <div className={`h-9 flex items-center px-3 rounded-md border text-xs font-medium ${row.is_amended ? 'bg-muted text-muted-foreground line-through' : 'bg-primary/10 text-primary border-primary/20'}`}>
  {t('results.serverComputed')}
  </div>
  ) : (
  <Select
  value={row.fallback_flag}
  onValueChange={(v: string) => updateRow(i, 'fallback_flag', v as ResultRow['fallback_flag'])}
  disabled={isRowDisabled}
  >
  <SelectTrigger className={fieldErrors[`results.${i}.fallback_flag`] ? 'border-destructive' : row.is_amended ? 'line-through' : ''}>
  <SelectValue placeholder={t('results.flag')} />
  </SelectTrigger>
  <SelectContent>
  <SelectItem value="NORMAL">{t('results.flags.NORMAL')}</SelectItem>
  <SelectItem value="ABNORMAL">{t('results.flags.ABNORMAL')}</SelectItem>
  <SelectItem value="CRITICAL">{t('results.flags.CRITICAL')}</SelectItem>
  </SelectContent>
  </Select>
  )}
 </div>

  {/* Actions */}
  <div className="col-span-12 sm:col-span-2 flex justify-end pb-0.5">
  {!isCompleted && rows.length > 1 && (
  <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
  <Trash2 className="h-4 w-4 text-destructive" />
  </Button>
  )}
  {isCompleted && !row.is_amended && row.result_id && !amendingRowId && (
    <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => setAmendingRowId(row.result_id!)}>
      {c('actions.amend')}
    </Button>
  )}
  {isEditingThisRow && (
    <div className="flex gap-1">
      <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setAmendingRowId(null)}>
        <Trash2 className="h-4 w-4 text-muted-foreground" />
      </Button>
      <Button variant="default" size="sm" className="h-9 text-xs px-2" onClick={() => handleAmendSubmit(i)} disabled={submitting}>
        {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : c('actions.save')}
      </Button>
    </div>
  )}
  </div>
 </div>
 );
 })}

  {!isCompleted && (
  <div className="flex flex-wrap gap-3 pt-2">
  <Button variant="outline" onClick={addRow} className="gap-2">
  <Plus className="h-4 w-4" /> {t('results.addAnalyte')}
  </Button>
  <DropdownMenu>
  <DropdownMenuTrigger asChild>
  <Button variant="outline" className="gap-2 text-primary border-primary/50 hover:bg-primary/10">
  <FileText className="h-4 w-4" /> {t('results.loadTemplate')} <ChevronDown className="h-3 w-3 opacity-50" />
  </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
  {Object.keys(TEMPLATES).map(t => (
  <DropdownMenuItem key={t} onClick={() => loadTemplate(t)}>
  {t} {c('misc.panel')}
  </DropdownMenuItem>
  ))}
  </DropdownMenuContent>
  </DropdownMenu>
  <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
  {t('results.submitResults')}
  </Button>
  {order.status === 'INPROGRESS' && order.results?.length > 0 && (
  <Button
    onClick={handleComplete}
    disabled={completing}
    className="gap-2 bg-green-600 hover:bg-green-700 text-white ml-auto"
  >
    {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
    {t('results.markAsComplete')}
  </Button>
  )}
  </div>
  )}
 </CardContent>
 </Card>
 </div>
 );
}
