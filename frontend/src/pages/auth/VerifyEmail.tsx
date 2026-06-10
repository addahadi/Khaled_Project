import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Verification token is missing.');
      return;
    }

    if (initialized.current) return;
    initialized.current = true;

    const verifyToken = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        
        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
          throw new Error(data.messageKey || 'Verification failed. The token may be invalid or expired.');
        }

        setStatus('success');
      } catch (err: any) {
        setStatus('error');
        setErrorMessage(err.message || 'An error occurred during verification.');
      }
    };

    verifyToken();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          DiagInfect
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">Email Verification</CardTitle>
            <CardDescription className="text-center">
              Please wait while we verify your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 space-y-6">
            {status === 'loading' && (
              <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
                <p className="text-gray-600">Verifying your email...</p>
              </div>
            )}
            
            {status === 'success' && (
              <div className="flex flex-col items-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <p className="text-lg font-medium text-gray-900 text-center">
                  Email Verified Successfully!
                </p>
                <p className="text-sm text-gray-500 text-center">
                  Your account is now active. You can log in to start using DiagInfect.
                </p>
                <Button className="w-full mt-4" onClick={() => navigate('/login')}>
                  Go to Login
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center space-y-4">
                <XCircle className="h-16 w-16 text-red-500" />
                <p className="text-lg font-medium text-gray-900 text-center">
                  Verification Failed
                </p>
                <p className="text-sm text-red-600 text-center bg-red-50 p-3 rounded-md w-full border border-red-200">
                  {errorMessage}
                </p>
                <Button variant="outline" className="w-full mt-4" onClick={() => navigate('/login')}>
                  Back to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
