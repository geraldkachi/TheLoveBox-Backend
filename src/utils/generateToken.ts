import jwt from "jsonwebtoken";

export function generateToken(id: string, role: string) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any,
  });
}
