import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="flex flex-1 flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-[440px] flex-col gap-8 px-6 py-16 md:py-24">
        <h1 className="font-serif text-[40px] leading-[1.1] tracking-[-0.03em] md:text-[48px]">
          Welcome <span className="text-sky">back</span>
        </h1>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
