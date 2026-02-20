import { redirect } from "next/navigation";

type VerifyPageProps = {
  searchParams?: {
    token?: string;
  };
};

export default function VerifyPage({ searchParams }: VerifyPageProps) {
  const token = searchParams?.token?.trim();
  if (!token) {
    redirect("/login?error=missing_token");
  }

  redirect(`/api/auth/verify?token=${encodeURIComponent(token)}`);
}
