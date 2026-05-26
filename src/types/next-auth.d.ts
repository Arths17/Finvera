import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    passwordHash: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
  }
}