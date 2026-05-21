import jwt from "jsonwebtoken";
import { config } from "../config/env";

export interface AdminTokenPayload {
  role: "admin";
  email: string;
  iat: number;
  exp: number;
}

export function signAdminToken(email: string): string {
  return jwt.sign({ role: "admin", email }, config.JWT_SECRET, { expiresIn: "8h" });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, config.JWT_SECRET) as AdminTokenPayload;
}
