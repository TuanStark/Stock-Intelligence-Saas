import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const res = await fetch('http://localhost:3001/api/v1/auth/login', {
            method: 'POST',
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
            headers: { 'Content-Type': 'application/json' },
          });

          const result = await res.json();

          if (result.success && result.data) {
            const { accessToken, user } = result.data;
            return {
              id: user.id,
              email: user.email,
              name: user.email,
              accessToken,
              tier: user.subscription?.tier || 'FREE',
            };
          }
          return null;
        } catch (error) {
          console.error('NextAuth authorize error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.accessToken = (user as any).accessToken;
        token.tier = (user as any).tier;
      }
      
      // Allow dynamic updating of session via trigger
      if (trigger === 'update' && session) {
        if (session.tier) token.tier = session.tier;
        if (session.accessToken) token.accessToken = session.accessToken;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session as any).accessToken = token.accessToken;
        (session as any).user.tier = token.tier;
        (session as any).user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'super-secret-stock-intel-key',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
