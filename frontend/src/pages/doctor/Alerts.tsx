import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlerts } from '@/contexts/AlertsContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/formatDate';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Bell, CheckCircle2, AlertTriangle, TrendingUp,
  Info, FlaskConical, AlertCircle, CheckCheck,
  UserPlus, UserCheck, ChevronLeft, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── Extended alert type ──────────────────────────────────────────────────────
// The AlertsContext interface is minimal; the backend may return patient_id and
// patient_name. We cast to EnrichedAlert to access these optional fields safely.
type EnrichedAlert = {
  alert_id:     string;
  alert_type:   string;
  message:      string;
  is_read:      boolean;
  created_at:   string;
  patient_id?:  string;
  patient_name?: string;
};

// ─── Alert type → config ──────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'warning' | 'info' | 'success';

interface AlertConfig {
  sev:   Severity;
  Icon:  LucideIcon;
  labelKey: string;
  ctaKey:   string;
}

const ALERT_CONFIG: Record<string, AlertConfig> = {
  RISK_CRITICAL:   { sev: 'critical', Icon: AlertTriangle, labelKey: 'labels.criticalRisk',    ctaKey: 'cta.viewPatient'  },
  RISK_HIGH:       { sev: 'high',     Icon: TrendingUp,    labelKey: 'labels.highRisk',         ctaKey: 'cta.viewPatient'  },
  RISK_MODERATE:   { sev: 'warning',  Icon: AlertCircle,   labelKey: 'labels.moderateRisk',     ctaKey: 'cta.viewPatient'  },
  RISK_LOW:        { sev: 'success',  Icon: CheckCircle2,  labelKey: 'labels.lowRisk',          ctaKey: 'cta.viewPatient'  },
  RESULT_READY:    { sev: 'info',     Icon: FlaskConical,  labelKey: 'labels.labResult',        ctaKey: 'cta.viewResults'  },
  CRITICAL_RESULT: { sev: 'critical', Icon: AlertTriangle, labelKey: 'labels.criticalResult',   ctaKey: 'cta.viewResults'  },
  ABNORMAL_RESULT: { sev: 'warning',  Icon: AlertCircle,   labelKey: 'labels.abnormalResult',   ctaKey: 'cta.viewResults'  },
  NEW_LAB_ORDER:   { sev: 'info',     Icon: FlaskConical,  labelKey: 'labels.labOrder',         ctaKey: 'cta.viewOrder'    },
  PATIENT_ASSIGNED: { sev: 'info',    Icon: UserPlus,      labelKey: 'labels.newPatient',       ctaKey: 'cta.viewPatient'  },
  PRIMARY_TRANSFERRED: { sev: 'info', Icon: UserCheck,     labelKey: 'labels.primaryDoctor',    ctaKey: 'cta.viewPatient'  },
};

const getAlertConfig = (type: string): AlertConfig =>
  ALERT_CONFIG[type] ?? { sev: 'info', Icon: Info, labelKey: type, ctaKey: 'cta.view' };

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

type FilterKey = 'ALL' | 'UNREAD' | 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'LAB_RESULTS' | 'SYSTEM';

// We'll map the labels directly in the component, but we can keep an array of keys here
const FILTER_KEYS: FilterKey[] = ['ALL', 'UNREAD', 'CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'LAB_RESULTS', 'SYSTEM'];

const matchFilter = (a: EnrichedAlert, f: FilterKey): boolean => {
  if (f === 'UNREAD')      return !a.is_read;
  if (f === 'CRITICAL')    return a.alert_type === 'RISK_CRITICAL' || a.alert_type === 'CRITICAL_RESULT';
  if (f === 'HIGH')        return a.alert_type === 'RISK_HIGH';
  if (f === 'MODERATE')    return a.alert_type === 'RISK_MODERATE';
  if (f === 'LOW')         return a.alert_type === 'RISK_LOW';
  if (f === 'LAB_RESULTS') return ['RESULT_READY', 'CRITICAL_RESULT', 'ABNORMAL_RESULT', 'NEW_LAB_ORDER'].includes(a.alert_type);
  if (f === 'SYSTEM')      return ['PATIENT_ASSIGNED', 'PRIMARY_TRANSFERRED', 'OVERAGE_STARTED'].includes(a.alert_type);
  return true;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { t } = useTranslation(['doctor', 'common']);
  const { lang } = useLanguage();
  const { alerts: rawAlerts, markRead, markAllRead, isLoading, unreadCount, pagination, page, setPage } = useAlerts();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>('ALL');

  // Helper: return a translated message if Arabic locale has a key for this alert type
  const getAlertMessage = (alert: EnrichedAlert): string => {
    if (lang === 'ar') {
      const key = `alerts.messages.${alert.alert_type}`;
      const translated = t(key, { name: alert.patient_name ?? '' });
      // i18next returns the key itself if not found — so only use if different
      if (translated && translated !== key) return translated;
    }
    return alert.message;
  };

  useEffect(() => {
    setPage(1);
  }, [filter, setPage]);

  // Cast to enriched type — patient_id / patient_name may be present in API response
  const alerts = rawAlerts as unknown as EnrichedAlert[];

  const filtered = alerts.filter(a => matchFilter(a, filter));

  const handleCta = (alert: EnrichedAlert) => {
    const cfg = getAlertConfig(alert.alert_type);
    if (cfg.ctaKey === 'cta.viewPatient') {
      navigate(alert.patient_id
        ? `/doctor/patients/${alert.patient_id}`
        : '/doctor/patients'
      );
    } else {
      // Lab result alerts — route to patient detail if patient_id available
      navigate(alert.patient_id
        ? `/doctor/patients/${alert.patient_id}`
        : '/doctor/patients'
      );
    }
  };

  return (
    <div className="space-y-5 w-full">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {t('alerts.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? unreadCount > 1 ? t('alerts.unreads', { count: unreadCount }) : t('alerts.unread', { count: unreadCount })
              : t('alerts.caughtUp')
            }
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={markAllRead}>
            <CheckCheck className="h-3.5 w-3.5" /> {t('alerts.markAllRead')}
          </Button>
        )}
      </div>

      {/* ── Filter chips ────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter alerts">
        {FILTER_KEYS.map((value) => {
          const count = value === 'UNREAD' ? unreadCount : alerts.filter(a => matchFilter(a, value)).length;
          
          let labelStr = '';
          if (value === 'ALL') labelStr = t('alerts.filters.all');
          else if (value === 'UNREAD') labelStr = `${t('alerts.filters.unread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`;
          else if (value === 'CRITICAL') labelStr = t('alerts.filters.critical');
          else if (value === 'HIGH') labelStr = t('alerts.filters.high');
          else if (value === 'MODERATE') labelStr = t('alerts.filters.moderate');
          else if (value === 'LOW') labelStr = t('alerts.filters.low');
          else if (value === 'LAB_RESULTS') labelStr = t('alerts.filters.labResults');
          else if (value === 'SYSTEM') labelStr = t('alerts.filters.system');

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
              {labelStr}{value !== 'ALL' && value !== 'UNREAD' && count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* ── Alert list ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-[76px] w-full rounded-[var(--radius)]" />)}
        </div>

      ) : filtered.length === 0 ? (
        <div className="rounded-[var(--radius)] border border-border bg-card py-14 text-center">
          <div className="w-11 h-11 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-5 w-5 text-[#00a89c]" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('alerts.caughtUp')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('alerts.noMatchFilter')}</p>
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
                aria-label={`${t(`alerts.${cfg.labelKey}`)} alert${alert.patient_name ? ` for ${alert.patient_name}` : ''}`}
              >
                {/* Severity icon */}
                <div className={`w-8 h-8 rounded-md ${sev.iconBg} flex items-center justify-center shrink-0 mt-0.5`}
                  aria-hidden="true">
                  <Icon className={`h-4 w-4 ${sev.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {/* Type badge */}
                    <span className={`text-[10px] font-medium uppercase tracking-[0.04em] px-1.5 py-0.5 rounded ${sev.badgeBg} ${sev.badgeText}`}>
                      {t(`alerts.${cfg.labelKey}`) ?? cfg.labelKey}
                    </span>

                    {/* Patient name */}
                    {alert.patient_name && (
                      <span className="text-sm font-medium text-foreground truncate">
                        {alert.patient_name}
                      </span>
                    )}

                    {/* Unread dot */}
                    {!alert.is_read && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-label="Unread" />
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground leading-snug">{getAlertMessage(alert)}</p>
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
                    {t(`alerts.${cfg.ctaKey}`) ?? cfg.ctaKey} →
                  </Button>
                  {!alert.is_read && (
                    <button
                      className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => markRead(alert.alert_id)}
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
            {t('alerts.pageOf', { page: pagination.page, pages: pagination.pages, total: pagination.total })}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {t('alerts.previous')}
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1"
              disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
            >
              {t('alerts.next')} <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
