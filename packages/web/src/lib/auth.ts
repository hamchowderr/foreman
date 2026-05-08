import { createClient } from "@/lib/server";

export type UserType = "guest" | "regular";

export type SessionUser = {
  id: string;
  email: string;
  image?: string | null;
  type?: UserType | undefined;
};

export type Session = {
  user: SessionUser;
};

export async function auth(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    user: {
      id: user.id,
      email: user.email ?? "",
      image: user.user_metadata?.avatar_url ?? null,
      type: "regular" as UserType,
    },
  };
}
