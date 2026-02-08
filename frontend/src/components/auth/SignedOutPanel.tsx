import { SignInButton } from "@/auth/clerk";

import { Button } from "@/components/ui/button";

type SignedOutPanelProps = {
  message: string;
  forceRedirectUrl: string;
  buttonLabel?: string;
};

export function SignedOutPanel({
  message,
  forceRedirectUrl,
  buttonLabel = "Sign in",
}: SignedOutPanelProps) {
  return (
    <div className="col-span-2 flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 p-10 text-center">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
        <p className="text-sm text-slate-600">{message}</p>
        <SignInButton mode="modal" forceRedirectUrl={forceRedirectUrl}>
          <Button className="mt-4">{buttonLabel}</Button>
        </SignInButton>
      </div>
    </div>
  );
}
