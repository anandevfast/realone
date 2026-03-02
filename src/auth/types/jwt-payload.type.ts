export type JwtPayload = {
  sub: string; // user id
  email: string;
  roles?: string[]; // optional
};
