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
import { Plus, Trash2, Loader2, ArrowLeft, User } from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { labResultsSchema, flattenZodErrors } from '@/api/schemas';

interface ResultRow {
  analyte_name: string;
  value: string;
  reference_low: string;
  reference_high: string;
  flag: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' | '';
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
    result_id: string;
    analyte_name: string;
    value: string;
    flag: string;
    unit_symbol: string;
  }>;
}

const emptyRow = (): ResultRow => ({
  analyte_name: '', value: '', reference_low: '', reference_high: '', flag: '',
});

export default function EnterResults() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
            analyte_name: r.analyte_name,
            value: r.value,
            reference_low: '',
            reference_high: '',
            flag: r.flag as ResultRow['flag'],
          })));
        }
      },
      onFinal: stopLoading,
    });
  }, [testId]);

  const updateRow = (i: number, field: keyof ResultRow, value: string) => {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = () => {
    const parsed = labResultsSchema.safeParse({ results: rows });
    if (!parsed.success) {
      setFieldErrors(flattenZodErrors(parsed.error));
      toast({ title: 'Validation Error', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    setFieldErrors({});

    const payload = {
      test_id: testId,
      results: parsed.data.results.map(r => ({
        analyte_name: r.analyte_name,
        value: r.value,
        reference_low: r.reference_low ? Number(r.reference_low) : undefined,
        reference_high: r.reference_high ? Number(r.reference_high) : undefined,
        flag: r.flag,
      })),
    };

    ApiManager.executeMutation({
      mutationFn: () => apiClient.post('/lab/results', payload),
      invalidateKeys: [['lab', 'orders'], ['lab', 'stats']],
      onStart: () => setSubmitting(true),
      onSuccess: (_data: unknown, msg: string) => {
        toast({ title: 'Results submitted', description: msg });
        navigate('/lab/orders');
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
    return <div className="text-center py-12 text-muted-foreground">Order not found.</div>;
  }

  const isCompleted = order.status === 'COMPLETED';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/lab/orders')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isCompleted ? 'View Results' : 'Enter Results'}
          </h1>
          <p className="text-muted-foreground">{order.test_type}</p>
        </div>
      </div>

      {/* Patient info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4 text-sm">
          <div><span className="text-muted-foreground">Name:</span><span className="ml-2 font-medium">{order.patient_name}</span></div>
          <div><span className="text-muted-foreground">Age:</span><span className="ml-2 font-medium">{order.patient_age}</span></div>
          <div><span className="text-muted-foreground">Gender:</span><span className="ml-2 font-medium">{order.patient_gender}</span></div>
          <div><span className="text-muted-foreground">Test:</span><span className="ml-2 font-medium">{order.test_type}</span></div>
          <div><span className="text-muted-foreground">Ordered By:</span><span className="ml-2 font-medium">{order.ordered_by_name ?? '—'}</span></div>
          <div>
            <span className="text-muted-foreground">Status:</span>
            <Badge className="ml-2 text-xs" variant={isCompleted ? 'default' : 'outline'}>{order.status}</Badge>
          </div>
          {order.notes && (
            <div className="col-span-3">
              <span className="text-muted-foreground">Notes:</span>
              <span className="ml-2">{order.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Result Entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg bg-muted/20">
              <div className="col-span-12 sm:col-span-3 space-y-1">
                <Label className="text-xs">Analyte Name</Label>
                <Input
                  placeholder="e.g. WBC Count"
                  value={row.analyte_name}
                  onChange={e => updateRow(i, 'analyte_name', e.target.value)}
                  disabled={isCompleted}
                  className={fieldErrors[`results.${i}.analyte_name`] ? 'border-destructive' : ''}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Value</Label>
                <Input
                  placeholder="e.g. 14.2"
                  value={row.value}
                  onChange={e => updateRow(i, 'value', e.target.value)}
                  disabled={isCompleted}
                  className={fieldErrors[`results.${i}.value`] ? 'border-destructive' : ''}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Ref. Low</Label>
                <Input
                  type="number" placeholder="0"
                  value={row.reference_low}
                  onChange={e => updateRow(i, 'reference_low', e.target.value)}
                  disabled={isCompleted}
                  className={fieldErrors[`results.${i}.reference_low`] ? 'border-destructive' : ''}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Ref. High</Label>
                <Input
                  type="number" placeholder="100"
                  value={row.reference_high}
                  onChange={e => updateRow(i, 'reference_high', e.target.value)}
                  disabled={isCompleted}
                  className={fieldErrors[`results.${i}.reference_high`] ? 'border-destructive' : ''}
                />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="text-xs">Flag</Label>
                <Select
                  value={row.flag}
                  onValueChange={(v: string) => updateRow(i, 'flag', v as ResultRow['flag'])}
                  disabled={isCompleted}
                >
                  <SelectTrigger className={fieldErrors[`results.${i}.flag`] ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Flag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="ABNORMAL">Abnormal</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-1 flex justify-end">
                {!isCompleted && rows.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {!isCompleted && (
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={addRow} className="gap-2">
                <Plus className="h-4 w-4" /> Add Analyte
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Results
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
