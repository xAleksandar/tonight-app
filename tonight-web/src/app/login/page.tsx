import { WelcomeScreen } from "@/components/tonight/WelcomeScreen";

type LoginPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  const emailParam = searchParams?.email;
  const nextParam = searchParams?.next;

  const defaultEmail = typeof emailParam === "string" ? emailParam : "";
  const redirectMessage =
    typeof nextParam === "string" && nextParam.length > 0
      ? "Sign in to continue"
      : undefined;

  return <WelcomeScreen defaultEmail={defaultEmail} redirectMessage={redirectMessage} />;
}
