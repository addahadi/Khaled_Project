import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  CreditCard, Zap, Shield, Building2, Check,
  CheckCircle2, AlertTriangle, Loader2, TrendingDown, TrendingUp,
} from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';
import { formatDate } from '@/lib/formatDate';
import { formatDZD } from '@/lib/formatPrice';
import { useTranslation, Trans } from 'react-i18next';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SubscriptionFeature { name_en: string; name_ar: string; is_enabled: boolean; value: number | null; }
interface Subscription {
  plan_id: string; plan_name_en: string; plan_name_ar: string; plan_description_en: string; plan_description_ar: string;
  status: 'ACTIVE' | 'CANCELLED' | 'TRIAL';
  is_trial: boolean; price_monthly: number | null; price_annually: number | null;
  current_cycle_start: string; current_cycle_end: string;
  features: SubscriptionFeature[];
  usage: { prediction_used: number; prediction_overage: number; prediction_limit: number | null };
}
interface PlanFeature { name_en: string; name_ar: string; is_enabled: boolean; value: number | null; }
interface Plan {
  plan_id: string; name_en: string; name_ar: string; description_en: string; description_ar: string;
  price_monthly: number | null; price_annually: number | null; is_trial: boolean;
  features: PlanFeature[];
}
interface OverageEvent {
  event_id: string; feature_name: string;
  overage_amount: number; created_at: string;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  trial: Zap, private: Shield, grand: Building2,
};

const FEATURE_LABELS: Record<string, string> = {
  predictions_per_month: 'Predictions / month',
  doctors_limit:         'Max doctors',
  lab_techs_limit:       'Max lab techs',
  xai_explanations:      'XAI explanations',
  priority_support:      'Priority support',
  api_access:            'API access',
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:    'bg-[#00a89c]/10 text-[#007a71] border border-[#00a89c]/25',
  TRIAL:     'bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30',
  CANCELLED: 'bg-muted text-muted-foreground border border-border',
};

// ─── Main component ────────────────────────────────────────────────────────────
export default function Subscription() {
  const { t, i18n } = useTranslation('manager');
  const lang = i18n.language;
  const { t: c } = useTranslation('common');
  const { toast } = useToast();
  const { isLoading: subLoading,     startLoading: startSub,     stopLoading: stopSub     } = useDelayedLoading();
  const { isLoading: plansLoading,   startLoading: startPlans,   stopLoading: stopPlans   } = useDelayedLoading();
  const { isLoading: overageLoading, startLoading: startOverage, stopLoading: stopOverage } = useDelayedLoading();

  const [subscription,  setSubscription]  = useState<Subscription | null>(null);
  const [plans,         setPlans]         = useState<Plan[]>([]);
  const [overageEvents, setOverageEvents] = useState<OverageEvent[]>([]);
  const [confirmPlan,   setConfirmPlan]   = useState<Plan | null>(null);
  const [switching,     setSwitching]     = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [cancelOpen,    setCancelOpen]    = useState(false);

  const refreshSub = () =>
    ApiManager.execute({
      queryKey: ['manager', 'subscription'],
      endpoint:  '/subscriptions/my',
      onSuccess: (d) => setSubscription((d as { subscription: Subscription }).subscription),
    });

  useEffect(() => {
    ApiManager.execute({ queryKey: ['manager', 'subscription'], endpoint: '/subscriptions/my', onStart: startSub, onSuccess: (d) => setSubscription((d as { subscription: Subscription }).subscription), onFinal: stopSub });
    ApiManager.execute({ queryKey: ['plans'], endpoint: '/plans', onStart: startPlans, onSuccess: (d) => { const raw = (d as { plans: Plan[] }).plans; setPlans(raw.map(p => ({ ...p, id: p.plan_id }))); }, onFinal: stopPlans });
    ApiManager.execute({ queryKey: ['manager', 'overage'], endpoint: '/subscriptions/overage', onStart: startOverage, onSuccess: (d) => setOverageEvents((d as { events: OverageEvent[] }).events), onFinal: stopOverage });
  }, [startSub, stopSub, startPlans, stopPlans, startOverage, stopOverage]);

  const handleSwitch = () => {
    if (!confirmPlan) return;
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.patch('/subscriptions/change-plan', { plan_id: confirmPlan.plan_id }),
      invalidateKeys: [['manager', 'subscription'], ['manager', 'reports']],
      onStart:   () => setSwitching(true),
      onSuccess: (_d, msg) => { toast({ title: t('subscription.planUpdated'), description: msg }); setConfirmPlan(null); refreshSub(); },
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setSwitching(false),
    });
  };

  const handleCancel = () => {
    ApiManager.executeMutation({
      mutationFn:     () => apiClient.delete('/subscriptions/my'),
      invalidateKeys: [['manager', 'subscription']],
      onStart:   () => setCancelling(true),
      onSuccess: (_d, msg) => { toast({ title: t('subscription.subscriptionCancelled'), description: msg }); setCancelOpen(false); refreshSub(); },
      onError:   ({ message }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal:   () => setCancelling(false),
    });
  };

  const usagePct = (() => {
    if (!subscription?.usage?.prediction_limit) return null;
    return Math.min((subscription.usage.prediction_used / subscription.usage.prediction_limit) * 100, 100);
  })();

  const getIcon = (planName: string) => {
    const key = planName.toLowerCase().split(' ')[0];
    return PLAN_ICONS[key] ?? Building2;
  };

  // Localised "50,000 DA/mo" | "8,000,000 DA/yr" | "Free Trial"
  const priceLabel = (pm: number | null, pa: number | null) => {
    if (pm) return `${formatDZD(pm, lang)}/${t('subscription.mo')}`;
    if (pa) return `${formatDZD(pa, lang)}/${t('subscription.yr')}`;
    return t('subscription.freeTrial');
  };

  const featureLabel = (f: PlanFeature | SubscriptionFeature) =>
    lang === 'ar' && f.name_ar ? f.name_ar : t(`subscription.featureLabels.${f.name_en}`, f.name_en);

  return (
    <div className="space-y-8 w-full">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{t('subscription.title')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{t('subscription.manageText')}</p>
      </div>

      {/* ── Current plan card ── */}
      <Card className="border-primary/25 bg-primary/[0.03]">
        <CardHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">{t('subscription.currentPlan')}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('subscription.activeSubscription')}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {subscription?.status === 'ACTIVE' && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5" onClick={() => setCancelOpen(true)}>
                  {t('subscription.cancelSubscription')}
                </Button>
              )}
              {subscription && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[subscription.status] ?? ''}`}>
                  {subscription.status.charAt(0) + subscription.status.slice(1).toLowerCase()}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {subLoading ? (
            <div className="space-y-3"><Skeleton className="h-7 w-36" /><Skeleton className="h-4 w-full" /></div>
          ) : subscription ? (
            <div className="space-y-5">
              {/* Plan name + price */}
              <div className="flex items-end gap-3">
                <h2 className="text-3xl font-semibold text-foreground tracking-tight">
                  {lang === 'ar' && subscription.plan_name_ar ? subscription.plan_name_ar : subscription.plan_name_en}
                </h2>
                {subscription.is_trial && (
                  <span className="mb-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30">{t('subscription.trial')}</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {lang === 'ar' && subscription.plan_description_ar ? subscription.plan_description_ar : subscription.plan_description_en}
              </p>

              {/* Cycle dates */}
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('subscription.cycleStart')}:</span>
                  <span className="font-medium">{formatDate(subscription.current_cycle_start)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t('subscription.cycleEnd')}:</span>
                  <span className="font-medium">{formatDate(subscription.current_cycle_end)}</span>
                </div>
              </div>

              {/* Usage bar */}
              {usagePct !== null && (
                <div className="space-y-2 pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('subscription.aiPredictionsUsed')}</span>
                    <span className="font-medium">
                      {subscription.usage.prediction_used}
                      <span className="text-muted-foreground"> / {subscription.usage.prediction_limit}</span>
                    </span>
                  </div>
                  <Progress
                    value={usagePct}
                    className={usagePct > 85 ? '[&>div]:bg-[#c0272d]' : '[&>div]:bg-primary'}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('subscription.usedPct', { pct: Math.round(usagePct) })}</span>
                    {usagePct > 85 && <span className="text-[#c0272d] font-medium">{t('subscription.approachingLimit')}</span>}
                  </div>
                  {subscription.usage.prediction_overage > 0 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#c0272d]/8 border border-[#c0272d]/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#c0272d] shrink-0" />
                      <p className="text-xs text-[#c0272d]">{t('subscription.overagePredictions', { count: subscription.usage.prediction_overage })}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 pt-2">
                {subscription.features.map(f => (
                  <span key={f.name_en} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    f.is_enabled
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-border line-through'
                  }`}>
                    {f.is_enabled && <Check className="h-3 w-3" />}
                    {featureLabel(f)}{f.value ? `: ${f.value}` : ''}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('subscription.noActiveSubscription')}</p>
          )}
        </CardContent>
      </Card>

      {/* ── Available plans ── */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">{t('subscription.availablePlans')}</h2>
        {plansLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-64 w-full rounded-[var(--radius)]" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {plans.map(plan => {
              const isCurrent = plan.plan_id === subscription?.plan_id;
              const PlanIcon  = getIcon(plan.name_en);
              const planName = lang === 'ar' && plan.name_ar ? plan.name_ar : plan.name_en;
              const planDesc = lang === 'ar' && plan.description_ar ? plan.description_ar : plan.description_en;
              return (
                <div
                  key={plan.plan_id}
                  className={`relative rounded-[var(--radius)] border-2 p-6 flex flex-col transition-all ${
                    isCurrent
                      ? 'border-primary bg-primary/[0.03] shadow-sm shadow-primary/10'
                      : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-3 py-1 rounded-full shadow-sm">
                        {t('subscription.currentPlanLabel')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCurrent ? 'bg-primary' : 'bg-muted'}`}>
                      <PlanIcon className={`h-4 w-4 ${isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{planName}</p>
                      {plan.is_trial && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#faaf3a]/15 text-[#a2680a] border border-[#faaf3a]/30">{t('subscription.trial')}</span>}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mb-2">
                    {plan.price_monthly ? (
                      <><span className="text-3xl font-semibold text-foreground">{formatDZD(plan.price_monthly, lang)}</span><span className="text-sm text-muted-foreground">/{t('subscription.mo')}</span></>
                    ) : plan.price_annually ? (
                      <><span className="text-3xl font-semibold text-foreground">{formatDZD(plan.price_annually, lang)}</span><span className="text-sm text-muted-foreground">/{t('subscription.yr')}</span></>
                    ) : (
                      <span className="text-xl font-semibold text-[#007a71]">{t('subscription.freeTrial')}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{planDesc}</p>

                  <ul className="space-y-2 flex-1 mb-5">
                    {plan.features.map(f => (
                      <li key={f.name_en} className={`flex items-center gap-2 text-xs ${f.is_enabled ? 'text-muted-foreground' : 'text-muted-foreground/50 line-through'}`}>
                        <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${f.is_enabled ? 'text-[#00a89c]' : 'text-muted-foreground/40'}`} />
                        {featureLabel(f)}{f.value ? ` (${f.value})` : ''}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent ? 'outline' : 'default'}
                    className="w-full"
                    disabled={isCurrent || (Boolean(subscription) && plan.is_trial)}
                    onClick={() => !isCurrent && setConfirmPlan(plan)}
                  >
                    {isCurrent ? t('subscription.currentPlanLabel') : Boolean(subscription) && plan.is_trial ? t('subscription.unavailable') : subscription ? t('subscription.switchToPlan') : t('subscription.subscribe')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Overage history ── */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">{t('subscription.billingHistory')}</h2>
        <Card>
          <CardContent className="px-0 py-0">
            {overageLoading ? (
              <div className="p-5 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
            ) : overageEvents.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-[#00a89c]/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-5 w-5 text-[#00a89c]" />
                </div>
                <p className="text-sm text-muted-foreground">{t('subscription.noOverageHistory')}</p>
              </div>
            ) : (
              overageEvents.map((event, i) => (
                <div key={event.event_id}
                  className={`flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors ${
                    i < overageEvents.length - 1 ? 'border-b border-border' : ''
                  }`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t('subscription.overageLabel')}: {t(`subscription.features.${event.feature_name}`) ?? event.feature_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.created_at)}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#c0272d]/10 text-[#c0272d] border border-[#c0272d]/20">
                    <AlertTriangle className="h-3 w-3" />
                    +{event.overage_amount} {t('subscription.used')}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Confirm switch dialog ── */}
      <Dialog open={!!confirmPlan} onOpenChange={() => setConfirmPlan(null)}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{t('subscription.dialogs.confirmSwitchTitle')}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {subscription && t('subscription.dialogs.confirmSwitchDesc')}
            </DialogDescription>
          </DialogHeader>

          {subscription && confirmPlan && (
            <div className="grid grid-cols-2 gap-3 py-1">
              <div className="rounded-[var(--radius)] border border-border p-3 bg-muted/30 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('subscription.current')}</p>
                <p className="font-semibold text-sm text-foreground">{lang === 'ar' && subscription.plan_name_ar ? subscription.plan_name_ar : subscription.plan_name_en}</p>
                <p className="text-xl font-semibold text-foreground">
                  {(subscription.price_monthly || subscription.price_annually) ? priceLabel(subscription.price_monthly, subscription.price_annually) : t('subscription.free')}
                </p>
              </div>
              <div className="rounded-[var(--radius)] border-2 border-primary p-3 bg-primary/5 space-y-1">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">{t('subscription.new')}</p>
                <p className="font-semibold text-sm text-foreground">{lang === 'ar' && confirmPlan.name_ar ? confirmPlan.name_ar : confirmPlan.name_en}</p>
                <p className="text-xl font-semibold text-foreground">
                  {(confirmPlan.price_monthly || confirmPlan.price_annually) ? priceLabel(confirmPlan.price_monthly, confirmPlan.price_annually) : t('subscription.free')}
                </p>
              </div>
            </div>
          )}

          {subscription && confirmPlan && (() => {
            // Only show a delta when both plans bill on the same (monthly) cycle
            if (!subscription.price_monthly || !confirmPlan.price_monthly) return null;
            const diff = confirmPlan.price_monthly - subscription.price_monthly;
            if (diff === 0) return null;
            return (
              <div className={`flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius)] text-sm font-medium ${
                diff > 0
                  ? 'bg-[#faaf3a]/10 text-[#a2680a]'
                  : 'bg-[#00a89c]/10 text-[#007a71]'
              }`}>
                {diff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {diff > 0 ? `+${formatDZD(diff, lang)}/${t('subscription.mo')} ${t('subscription.dialogs.increase')}` : `-${formatDZD(Math.abs(diff), lang)}/${t('subscription.mo')} ${t('subscription.dialogs.savings')}`}
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmPlan(null)}>{c('actions.cancel')}</Button>
            <Button onClick={handleSwitch} disabled={switching}>
              {switching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('subscription.dialogs.confirmSwitch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel confirm dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="rounded-xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> {t('subscription.dialogs.cancelSubscriptionTitle')}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              <Trans i18nKey="subscription.dialogs.cancelSubscriptionDesc" t={t}>You will <strong>immediately lose access</strong> to all AI prediction features and premium capabilities. This cannot be undone.</Trans>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>{t('subscription.dialogs.keepSubscription')}</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('subscription.cancelSubscription')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
