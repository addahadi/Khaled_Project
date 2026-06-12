import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain, Search, CheckCircle2, ChevronRight,
  Calendar, User, Building2,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import { getRiskConfig, RISK_CONFIG } from '@/lib/riskConfig';
import type { RiskLevel } from '@/lib/riskConfig';
import { useTranslation } from 'react-i18next';

interface Prediction {
  request_id:    string; patient_id: string; patient_name: string;
  model_version: string; status: string; created_at: string;
  risk_score:    number | null; risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | null;
  confidence:    number | null;
}

interface Pagination {
  total: number; page: number; limit: number; pages: number;
}

const RISK_SUMMARY_STYLES = {
  CRITICAL: { text: 'text-[#c0272d]', bg: 'bg-[#c0272d]/8', border: 'border-[#c0272d]/20' },
  HIGH:     { text: 'text-[#e07020]', bg: 'bg-[#e07020]/8', border: 'border-[#e07020]/20' },
  MODERATE: { text: 'text-[#a2680a]', bg: 'bg-[#faaf3a]/10', border: 'border-[#faaf3a]/25' },
  LOW:      { text: 'text-[#007a71]', bg: 'bg-[#00a89c]/8',  border: 'border-[#00a89c]/20' },
} as const;

export default function PredictionHistory() {
  const { t } = useTranslation(['doctor', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, startLoading, stopLoading } = useDelayedLoading();

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [pagination,  setPagination]  = useState<Pagination | null>(null);
  const [counts,      setCounts]      = useState<Record<RiskLevel, number>>({ CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 });
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [riskFilter,  setRiskFilter]  = useState('ALL');
  const [dateFilter,  setDateFilter]  = useState('ALL');
  const [scope,       setScope]       = useState<'mine' | 'org'>(
    () => (localStorage.getItem('diaginfect_prediction_scope') as 'mine' | 'org' | null) ?? 'org'
  );

  const handleScopeChange = (val: 'mine' | 'org') => {
    setScope(val);
    setPage(1);
    localStorage.setItem('diaginfect_prediction_scope', val);
  };

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['doctor', 'predictions', scope, String(page), search, riskFilter, dateFilter],
      endpoint: `/doctor/predictions?scope=${scope}&page=${page}&limit=8&search=${encodeURIComponent(search)}&risk=${riskFilter}&date_range=${dateFilter}`,
      onStart:   startLoading,
      onSuccess: (d) => {
        const payload = d as { predictions: Prediction[], pagination: Pagination, riskCounts: Record<string, number> };
        setPredictions(payload.predictions);
        setPagination(payload.pagination);
        setCounts({
          CRITICAL: payload.riskCounts?.CRITICAL ?? 0,
          HIGH:     payload.riskCounts?.HIGH     ?? 0,
          MODERATE: payload.riskCounts?.MODERATE ?? 0,
          LOW:      payload.riskCounts?.LOW      ?? 0,
        });
      },
      onFinal:   stopLoading,
    });
  }, [scope, page, search, riskFilter, dateFilter, startLoading, stopLoading]);

  // Deep-link: if navigated with openPrediction state, redirect to detail page
  useEffect(() => {
    const targetId = (location.state as { openPrediction?: string })?.openPrediction;
    if (targetId) {
      navigate(`/doctor/predictions/${targetId}`, { replace: true });
    }
  }, [location.state, navigate]);

  return (
    <div className="space-y-6 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('predictions.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{pagination?.total ?? 0} {t('predictionHistory.totalPredictions')}</p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/doctor/predictions/new')}>
          <Brain className="h-4 w-4" /> {t('predictions.newPrediction')}
        </Button>
      </div>

      {/* Scope toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-[var(--radius)] w-fit">
        {(['mine', 'org'] as const).map(s => (
          <button
            key={s}
            onClick={() => handleScopeChange(s)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              scope === s
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === 'mine' ? <User className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
            {s === 'mine' ? t('predictionHistory.myPredictions') : t('predictionHistory.allPredictions')}
          </button>
        ))}
      </div>

      {/* Summary cards — clickable risk filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.keys(RISK_SUMMARY_STYLES) as RiskLevel[]).map(level => {
          const style = RISK_SUMMARY_STYLES[level];
          const cfg   = RISK_CONFIG[level];
          return (
            <button
              key={level}
              onClick={() => { setRiskFilter(riskFilter === level ? 'ALL' : level); setPage(1); }}
              className={`p-4 rounded-[var(--radius)] border text-left transition-all ${style.bg} ${style.border} ${
                riskFilter === level ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:shadow-sm'
              }`}
            >
              <p className={`text-3xl font-semibold ${style.text}`}>{counts[level]}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{t(`patients.riskLevels.${level}`) ?? cfg.label} {t('predictionHistory.risk')}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder={t('predictionHistory.searchByPatient')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={dateFilter} onValueChange={val => { setDateFilter(val); setPage(1); }}>
          <SelectTrigger className="w-[160px] bg-card">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder={t('predictionHistory.dateRange')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t('predictionHistory.allTime')}</SelectItem>
            <SelectItem value="TODAY">{t('predictionHistory.today')}</SelectItem>
            <SelectItem value="7DAYS">{t('predictionHistory.last7Days')}</SelectItem>
            <SelectItem value="30DAYS">{t('predictionHistory.thisMonth')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Prediction list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />)}
        </div>
      ) : predictions.length === 0 && (search || riskFilter !== 'ALL' || dateFilter !== 'ALL') ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('predictionHistory.noMatch')}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { setSearch(''); setRiskFilter('ALL'); setDateFilter('ALL'); setPage(1); }}>
              {t('predictionHistory.clearFilters')}
            </Button>
          </CardContent>
        </Card>
      ) : predictions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{t('predictions.noPredictions')}</p>
            <Button size="sm" className="mt-4 gap-2" onClick={() => navigate('/doctor/predictions/new')}>
              <Brain className="h-4 w-4" /> {t('predictions.runFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {predictions.map(p => {
            const cfg = getRiskConfig(p.risk_level);
            const RiskIcon = cfg?.icon;
            return (
              <Card
                key={p.request_id}
                className="cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all duration-150"
                onClick={() => navigate(`/doctor/predictions/${p.request_id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Risk icon box */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    p.risk_level === 'CRITICAL' ? 'bg-[#c0272d]/10'
                    : p.risk_level === 'HIGH'   ? 'bg-[#e07020]/10'
                    : p.risk_level === 'MODERATE'? 'bg-[#faaf3a]/10'
                    : p.risk_level === 'LOW'     ? 'bg-[#00a89c]/10'
                    : 'bg-muted'
                  }`}>
                    {cfg && RiskIcon
                      ? <RiskIcon className={`h-5 w-5 ${cfg.color}`} />
                      : <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-foreground truncate">{p.patient_name}</span>
                      {cfg && RiskIcon && (
                        <Badge className={`text-xs gap-1 ${cfg.badgeClass}`}>
                          <RiskIcon className="h-3 w-3" /> {t(`patients.riskLevels.${p.risk_level}`) ?? cfg.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {p.risk_score !== null && (
                        <span className="text-xs text-muted-foreground">
                          {t('dashboard.score')} <span className="font-medium text-foreground">{Math.round(p.risk_score * 100)}%</span>
                        </span>
                      )}
                      {p.confidence !== null && (
                        <span className="text-xs text-muted-foreground">
                          {t('predictionDetail.confidence')} <span className="font-medium text-foreground">{Math.round(p.confidence * 100)}%</span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatDate(p.created_at)}</span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                </CardContent>
              </Card>
            );
          })}

          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-border/50 pt-4 mt-6">
              <p className="text-sm text-muted-foreground">
                {t('predictionHistory.pageOf', { page: pagination.page, pages: pagination.pages, total: pagination.total })}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  {t('predictionHistory.previous')}
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                >
                  {t('predictionHistory.next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
