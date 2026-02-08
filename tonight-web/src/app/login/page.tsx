import { WelcomeScreen } from "@/components/tonight/WelcomeScreen";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const emailParam = params?.email;
  const nextParam = params?.next;

  const defaultEmail = typeof emailParam === "string" ? emailParam : "";
  const redirectMessage =
    typeof nextParam === "string" && nextParam.length > 0
      ? "Sign in to continue"
      : undefined;

  return <WelcomeScreen defaultEmail={defaultEmail} redirectMessage={redirectMessage} />;
}
