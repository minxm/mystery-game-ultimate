import { Suspense } from 'react';
import InterrogateClient from './InterrogateClient';

function InterrogateLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-blood-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function InterrogatePage() {
  return (
    <Suspense fallback={<InterrogateLoading />}>
      <InterrogateClient />
    </Suspense>
  );
}
