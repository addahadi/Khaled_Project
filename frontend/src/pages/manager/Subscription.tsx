import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, CreditCard, Loader2, Zap, Shield, Building2 } from 'lucide-react';
import ApiManager from '@/api/ApiManager';
import apiClient from '@/api/apiClient';
import { useDelayedLoading } from '@/api/useDelayedLoading';

interface PlanFeature { name: string; is_enabled: boolean; value: number | null }

interface Plan {
  plan_id: string;   // ← backend always returns plan_id (not id)
  name: string;
  description: string;
  price_monthly: number | null;
  price_annually: number | null;
  is_trial: boolean;
  features: PlanFeature[];
}

interface Subscription {
  subscription_id: string;
  plan_id: string;
  plan_name: string;
  plan_description: string;
  price_monthly: number | null;
  is_trial: boolean;
  status: string;
  current_cycle_start: string;
  current_cycle_end: string;
  features: PlanFeature[];
  usage: { prediction_used: number; prediction_overage: number };
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  trial: Zap, clinic: Shield, hospital: Building2,
};

const FEATURE_LABELS: Record<string, string> = {
  predictions_per_month: 'Predictions / month',
  doctors_limit:          'Max doctors',
  lab_techs_limit:        'Max lab techs',
  xai_explanations:       'XAI explanations',
  priority_support:       'Priority support',
  api_access:             'API access',
};

export default function Subscription() {
  const { toast } = useToast();
  const { isLoading: subLoading, startLoading: startSub, stopLoading: stopSub } = useDelayedLoading();
  const { isLoading: plansLoading, startLoading: startPlans, stopLoading: stopPlans } = useDelayedLoading();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    ApiManager.execute({
      queryKey: ['manager', 'subscription'],
      endpoint: '/subscriptions/my',
      onStart: startSub,
      onSuccess: (data: unknown) => setSubscription((data as { subscription: Subscription }).subscription),
      onFinal: stopSub,
    });

    ApiManager.execute({
      queryKey: ['plans'],
      endpoint: '/plans',
      onStart: startPlans,
      onSuccess: (data: unknown) => {
        // Map using plan_id — never p.id
        const raw = (data as { plans: Plan[] }).plans;
        setPlans(raw.map(p => ({ ...p, id: p.plan_id })));
      },
      onFinal: stopPlans,
    });
  }, []);

  const handleSwitch = () => {
    if (!confirmPlan) return;

    ApiManager.executeMutation({
      // Use plan_id field from backend, never .id
      mutationFn: () => apiClient.patch('/subscriptions/change-plan', { plan_id: confirmPlan.plan_id }),
      invalidateKeys: [['manager', 'subscription'], ['manager', 'reports']],
      onStart: () => setSwitching(true),
      onSuccess: (_data: unknown, msg: string) => {
        toast({ title: 'Plan updated', description: msg });
        setConfirmPlan(null);
        // Refresh subscription
        ApiManager.execute({
          queryKey: ['manager', 'subscription'],
          endpoint: '/subscriptions/my',
          onSuccess: (data: unknown) => setSubscription((data as { subscription: Subscription }).subscription),
        });
      },
      onError: ({ message }: { message: string }) => toast({ title: 'Error', description: message, variant: 'destructive' }),
      onFinal: () => setSwitching(false),
    });
  };

  const usagePct = (() => {
    if (!subscription) return null;
    const limit = subscription.features.find(f => f.name === 'predictions_per_month')?.value;
    if (!limit) return null;
    return Math.min((subscription.usage.prediction_used / limit) * 100, 100);
  })();

  const getIcon = (planName: string) => {
    const key = planName.toLowerCase().split(' ')[0];
    return PLAN_ICONS[key] ?? Building2;
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Subscription</h1>

      {/* Current subscription */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                <CreditCard className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Current Plan</CardTitle>
                <CardDescription>Your active subscription</CardDescription>
              </div>
            </div>
            {subscription && (
              <Badge variant="default" className="text-sm">{subscription.status}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {subLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : subscription ? (
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{subscription.plan_name}</span>
                {subscription.is_trial && <Badge variant="secondary">Trial</Badge>}
              </div>
              <p className="text-muted-foreground">{subscription.plan_description}</p>

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Cycle Start:</span>
                  <span className="ml-2 font-medium">
                    {new Date(subscription.current_cycle_start).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cycle End:</span>
                  <span className="ml-2 font-medium">
                    {new Date(subscription.current_cycle_end).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Usage */}
              {usagePct !== null && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex justify-between text-sm">
                    <span>AI Predictions Used</span>
                    <span className="font-medium">
                      {subscription.usage.prediction_used} / {subscription.features.find(f => f.name === 'predictions_per_month')?.value}
                    </span>
                  </div>
                  <Progress
                    value={usagePct}
                    className={usagePct > 85 ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}
                  />
                  {subscription.usage.prediction_overage > 0 && (
                    <p className="text-xs text-destructive">
                      {subscription.usage.prediction_overage} overage predictions this cycle
                    </p>
                  )}
                </div>
              )}

              {/* Features */}
              <div className="flex flex-wrap gap-2 pt-2">
                {subscription.features.map(f => (
                  <Badge key={f.name} variant={f.is_enabled ? 'default' : 'secondary'} className="text-xs gap-1">
                    {f.is_enabled && <CheckCircle2 className="h-3 w-3" />}
                    {FEATURE_LABELS[f.name] ?? f.name}
                    {f.value && `: ${f.value}`}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No active subscription. Choose a plan below.</p>
          )}
        </CardContent>
      </Card>

      {/* Available plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        {plansLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map(plan => {
              // Always use plan.plan_id for comparison — never plan.id
              const isCurrent = plan.plan_id === subscription?.plan_id;
              const PlanIcon = getIcon(plan.name);

              return (
                <Card
                  key={plan.plan_id}
                  className={`relative transition-all ${
                    isCurrent
                      ? 'border-primary ring-1 ring-primary/40 shadow-md'
                      : 'hover:shadow-md hover:border-primary/30'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="text-xs shadow-sm">Current Plan</Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-1">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isCurrent ? 'bg-primary' : 'bg-muted'}`}>
                        <PlanIcon className={`h-5 w-5 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                        {plan.is_trial && <Badge variant="secondary" className="text-xs">Trial</Badge>}
                      </div>
                    </div>
                    <div className="flex items-end gap-1">
                      {plan.price_monthly ? (
                        <>
                          <span className="text-3xl font-bold">${plan.price_monthly}</span>
                          <span className="text-muted-foreground text-sm mb-1">/mo</span>
                        </>
                      ) : (
                        <span className="text-xl font-semibold text-muted-foreground">Free Trial</span>
                      )}
                    </div>
                    <CardDescription className="text-xs">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ul className="space-y-1.5">
                      {plan.features.map(f => (
                        <li key={f.name} className={`flex items-center gap-2 text-xs ${f.is_enabled ? '' : 'text-muted-foreground line-through'}`}>
                          <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${f.is_enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                          {FEATURE_LABELS[f.name] ?? f.name}
                          {f.value && ` (${f.value})`}
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={isCurrent ? 'outline' : 'default'}
                      disabled={isCurrent}
                      onClick={() => !isCurrent && setConfirmPlan(plan)}
                    >
                      {isCurrent ? 'Current Plan' : subscription ? 'Switch to this Plan' : 'Subscribe'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm switch dialog */}
      <Dialog open={!!confirmPlan} onOpenChange={() => setConfirmPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Plan Switch</DialogTitle>
            <DialogDescription>
              You are switching to the <strong>{confirmPlan?.name}</strong> plan.
              {subscription && ' Your current plan will be cancelled immediately and a new billing cycle will start.'}
            </DialogDescription>
          </DialogHeader>
          {confirmPlan?.price_monthly && (
            <div className="text-center py-4 border rounded-lg bg-muted/30">
              <div className="text-3xl font-bold">${confirmPlan.price_monthly}</div>
              <div className="text-sm text-muted-foreground">per month, starting today</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPlan(null)}>Cancel</Button>
            <Button onClick={handleSwitch} disabled={switching}>
              {switching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
