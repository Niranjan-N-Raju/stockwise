export type UserDocument = {
  username: string;
  passwordHash: string;
  role: "admin" | "staff";
  createdAt: Date;
  updatedAt: Date;
};