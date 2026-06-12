import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/api/apiClient';
import { useTranslation } from 'react-i18next';

export default function VerifySubscriptionChange() {
  const { t } = useTranslation('manager');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const executed = useRef(false);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No token provided.');
      return;
    }

    if (executed.current) return;
    executed.current = true;

    const verifyToken = async () => {
      try {
        await apiClient.post('/subscriptions/verify-change', { token });
        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'Failed to verify subscription change.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('verifySubscription.title')}</CardTitle>
          <CardDescription>
            {status === 'loading' && t('verifySubscription.verifying')}
            {status === 'success' && t('verifySubscription.successTitle')}
            {status === 'error' && t('verifySubscription.errorTitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-6 pb-8">
          {status === 'loading' && (
            <div className="flex flex-col items-center space-y-4 text-muted-foreground">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <p>{t('verifySubscription.waitMessage')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <CheckCircle2 className="h-20 w-20 text-green-500" />
              <p className="text-sm text-muted-foreground">
                {t('verifySubscription.successMessage')}
              </p>
              <Button onClick={() => navigate('/manager/subscription')} className="w-full mt-4">
                {t('verifySubscription.returnToDashboard')}
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center space-y-4 text-center">
              <XCircle className="h-20 w-20 text-destructive" />
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button onClick={() => navigate('/manager/subscription')} variant="outline" className="w-full mt-4">
                {t('verifySubscription.backToDashboard')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
