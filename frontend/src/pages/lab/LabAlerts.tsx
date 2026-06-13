import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import {
  Bell, CheckCircle2, AlertTriangle, AlertCircle,
  ClipboardList, CheckCheck, ChevronLeft, ChevronRight, type LucideIcon,
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabAlert {
  alert_id:     string;
  patient_id:   string | null;
  patient_name: string | null;
  alert_type:   string;
  message:      string;
  is_read:      boolean;
  read_at:      string | null;
  created_at:   string;
}

interface Pagination {
  page: number; limit: number; total: number; pages: number;
}

// ─── Alert type → config ──────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'warning' | 'info' | 'success';

interface AlertConfig {
  sev:   Severity;
  Icon:  LucideIcon;
  label: string;
  cta:   string;
}

const ALERT_CONFIG: Record<string, AlertConfig> = {
  CRITICAL_RESULT: {
    sev:   'critical',
    Icon:  AlertTriangle,
    label: 'Critical result',
    cta:   'Enter results',
  },
  NEW_LAB_ORDER: {
    sev:   'info',
    Icon:  ClipboardList,
    label: 'New order',
    cta:   'Open order',
  },
  ABNORMAL_RESULT: {
    sev:   'warning',
    Icon:  AlertCircle,
    label: 'Abnormal result',
    cta:   'View results',
  },
  RESULT_READY: {
    sev:   'success',
    Icon:  CheckCircle2,
    label: 'Result ready',
    cta:   'View results',
  },
};

const getAlertConfig = (type: string): AlertConfig =>
  ALERT_CONFIG[type] ?? {
    sev:   'info' as Severity,
    Icon:  Bell,
    label: type.toLowerCase().replace(/_/g, ' '),
    cta:   'View',
  };

// ─── Severity display tokens ──────────────────────────────────────────────────

const SEV: Record<Severity, {
  borderColor: string;
  iconBg:      string;
  iconColor:   string;
  badgeBg:     string;
  badgeText:   string;
}> = {
  critical: {
    borderColor: '#c0272d',
    iconBg:      'bg-[#c0272d]/10',
    iconColor:   'text-[#c0272d]',
    badgeBg:     'bg-[#c0272d]/10',
    badgeText:   'text-[#c0272d]',
  },
  high: {
    borderColor: '#e07020',
    iconBg:      'bg-[#e07020]/10',
    iconColor:   'text-[#e07020]',
    badgeBg:     'bg-[#e07020]/10',
    badgeText:   'text-[#e07020]',
  },
  warning: {
    borderColor: '#faaf3a',
    iconBg:      'bg-[#faaf3a]/15',
    iconColor:   'text-[#a2680a]',
    badgeBg:     'bg-[#faaf3a]/15',
    badgeText:   'text-[#a2680a]',
  },
  info: {
    borderColor: 'hsl(var(--primary))',
    iconBg:      'bg-primary/10',
    iconColor:   'text-primary',
    badgeBg:     'bg-primary/10',
    badgeText:   'text-primary',
  },
  success: {
    borderColor: '#00a89c',
    iconBg:      'bg-[#00a89c]/10',
    iconColor:   'text-[#007a71]',
    badgeBg:     'bg-[#00a89c]/10',
    badgeText:   'text-[#007a71]',
  },
};

// ─── Filter types ─────────────────────────────────────────────────────────────

type FilterKey = 'ALL' | 'UNREAD' | 'NEW_ORDERS' | 'CRITICAL' | 'ABNORMAL';

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: 'ALL',        label: 'All' },
  { value: 'UNREAD',     label: 'Unread' },
  { value: 'NEW_ORDERS', label: 'New orders' },
  { value: 'CRITICAL',   label: 'Critical' },
  { value: 'ABNORMAL',   label: 'Abnormal' },
];

const matchFilter = (a: LabAlert, f: FilterKey): boolean => {
  if (f === 'UNREAD')     return !a.is_read;
  if (f === 'NEW_ORDERS') return a.alert_type === 'NEW_LAB_ORDER';
  if (f === 'CRITICAL')   return a.alert_type === 'CRITICAL_RESULT';
  if (f === 'ABNORMAL')   return a.alert_type === 'ABNORMAL_RESULT';
  return true;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LabAlerts() {
  const { t } = useTranslation('lab');
  const { t: c } = useTranslation('common');
  const navigate      = useNavigate();
  const { toast }     = useToast();
  const [alerts,      setAlerts]     = useState<LabAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination,  setPagination] = useState<Pagination | null>(null);
  const [page,        setPage]       = useState(1);
  const [isLoading,   setIsLoading]  = useState(true);
  const [markingAll,  setMarkingAll] = useState(false);
  const [filter,      setFilter]     = useState<FilterKey>('ALL');

  const loadAlerts = useCallback(() => {
    ApiManager.execute({
      queryKey: ['lab', 'alerts', String(page)],
      endpoint: `/lab/alerts?page=${page}&limit=8`,
      onStart:   () => setIsLoading(true),
      onSuccess: (d: unknown) => {
        const data = d as { alerts: LabAlert[], unread_count: number, pagination: Pagination };
        setAlerts(data.alerts ?? []);
        setUnreadCount(data.unread_count ?? 0);
        setPagination(data.pagination);
      },
      onFinal: () => setIsLoading(false),
    });
  }, [page]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { setPage(1); }, [filter]);

  // ── Mark one read ─────────────────────────────────────────────────────────
  const handleMarkRead = (alertId: string) => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch(`/lab/alerts/${alertId}/read`),
      invalidateKeys: [['lab', 'alerts']],
      onSuccess: () => {
        setAlerts(prev =>
          prev.map(a =>
            a.alert_id === alertId
              ? { ...a, is_read: true, read_at: new Date().toISOString() }
              : a
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      },
      onError: ({ message }) =>
        toast({ title: 'Error', description: message, variant: 'destructive' }),
    });
  };

  // ── Mark all read ─────────────────────────────────────────────────────────
  const handleMarkAllRead = () => {
    ApiManager.executeMutation({
      mutationFn: () => apiClient.patch('/lab/alerts/read-all'),
      invalidateKeys: [['lab', 'alerts']],
      onStart:   () => setMarkingAll(true),
      onSuccess: () => {
        setAlerts(prev =>
          prev.map(a => ({
            ...a,
            is_read: true,
            read_at: a.read_at ?? new Date().toISOString(),
          }))
        );
        setUnreadCount(0);
        toast({ title: t('alerts.allMarkedRead') });
      },
      onError: ({ message }) =>
        toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setMarkingAll(false),
    });
  };

  // ── CTA navigation ────────────────────────────────────────────────────────
  // All lab alert CTAs land on the orders page — the tech finds and acts on
  // the relevant order there. A future enhancement could deep-link to
  // /lab/orders/:testId when test_id is available in the alert payload.
  const handleCta = (_alert: LabAlert) => {
    navigate('/lab/orders');
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered    = alerts.filter(a => matchFilter(a, filter));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {t('alerts.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
            {t('alerts.subtitle')}
            {unreadCount > 0 && <span>· {t('alerts.unreadCount', { count: unreadCount })}</span>}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('alerts.markAllRead')}
          </Button>
        )}
      </div>

      {/* ── Filter chips ────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter alerts">
        {FILTERS.map(({ value, label }) => {
          const count =
            value === 'UNREAD'     ? unreadCount :
            value === 'NEW_ORDERS' ? alerts.filter(a => a.alert_type === 'NEW_LAB_ORDER').length :
            value === 'CRITICAL'   ? alerts.filter(a => a.alert_type === 'CRITICAL_RESULT').length :
            value === 'ABNORMAL'   ? alerts.filter(a => a.alert_type === 'ABNORMAL_RESULT').length :
            alerts.length;

          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filter === value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
              }`}
            >
              {t(`alerts.filters.${value}`) ?? label}{count > 0 && value !== 'ALL' ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* ── Alert list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[76px] w-full rounded-[var(--radius)]" />
          ))}
        </div>

      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-border bg-card py-14 text-center">
          <div className="w-11 h-11 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-5 w-5 text-[#00a89c]" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('alerts.allCaughtUp')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('alerts.noAlerts')}</p>
        </div>

      ) : (
        <div className="space-y-2">
          {filtered.map(alert => {
            const cfg  = getAlertConfig(alert.alert_type);
            const sev  = SEV[cfg.sev];
            const Icon = cfg.Icon;

            return (
              <div
                key={alert.alert_id}
                className="rounded-[var(--radius)] border border-border bg-card p-3.5 flex items-start gap-3 transition-opacity"
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: sev.borderColor,
                  opacity: alert.is_read ? 0.5 : 1,
                }}
                role="article"
                aria-label={`${cfg.label} alert${alert.patient_name ? ` for ${alert.patient_name}` : ''}`}
              >
                {/* Severity icon */}
                <div
                  className={`w-8 h-8 rounded-md ${sev.iconBg} flex items-center justify-center shrink-0 mt-0.5`}
                  aria-hidden="true"
                >
                  <Icon className={`h-4 w-4 ${sev.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-medium uppercase tracking-[0.04em] px-1.5 py-0.5 rounded ${sev.badgeBg} ${sev.badgeText}`}>
                      {t(`alerts.types.${alert.alert_type}.label`) ?? cfg.label}
                    </span>
                    {alert.patient_name && (
                      <span className="text-sm font-medium text-foreground truncate">
                        {alert.patient_name}
                      </span>
                    )}
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-label="Unread" />
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-snug">
                    {t(`alerts.messages.${alert.alert_type}`, { defaultValue: alert.message })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(alert.created_at)}</p>
                </div>

                {/* Actions */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs whitespace-nowrap gap-1"
                    onClick={() => handleCta(alert)}
                  >
                    {t(`alerts.types.${alert.alert_type}.cta`) ?? cfg.cta} →
                  </Button>
                  {!alert.is_read && (
                    <button
                      className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => handleMarkRead(alert.alert_id)}
                    >
                      {t('alerts.markRead')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between py-3 border-t border-border mt-6">
          <p className="text-xs text-muted-foreground">
            <Trans i18nKey="alerts.pagination" t={t} values={{page: pagination.page, pages: pagination.pages, total: pagination.total}}>Page {{page: pagination.page}} of {{pages: pagination.pages}} · {{total: pagination.total}} alerts</Trans>
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {c('pagination.previous')}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1"
              disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
            >
              {c('pagination.next')} <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
