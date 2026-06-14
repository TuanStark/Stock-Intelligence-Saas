import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { authApi } from "@/lib/api/auth.api";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const result = await authApi.login(
            credentials.email,
            credentials.password,
          );

          if (result.success && result.data) {
            const { accessToken, refreshToken, user } = result.data;
            return {
              id: user.id,
              email: user.email,
              name: user.email,
              accessToken,
              refreshToken,
              tier: user.subscription?.tier || "FREE",
            };
          }
          return null;
        } catch (error) {
          console.error("NextAuth authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (account?.provider === "google" && account.id_token) {
        try {
          const result = await authApi.googleLogin(account.id_token);

          if (result.success && result.data) {
            const { accessToken, refreshToken, user: apiUser } = result.data;
            token.accessToken = accessToken;
            token.refreshToken = refreshToken;
            token.tier = apiUser.subscription?.tier || "FREE";
          }
        } catch (error) {
          console.error("NextAuth google jwt error:", error);
        }
      } else if (user) {
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.tier = (user as any).tier;
      }

      // Allow dynamic updating of session via trigger
      if (trigger === "update" && session) {
        if (session.tier) token.tier = session.tier;
        if (session.accessToken) token.accessToken = session.accessToken;
        if (session.refreshToken) token.refreshToken = session.refreshToken;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).accessToken = token.accessToken;
        (session as any).refreshToken = token.refreshToken;
        (session as any).user.tier = token.tier;
        (session as any).user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || "super-secret-stock-intel-key",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
