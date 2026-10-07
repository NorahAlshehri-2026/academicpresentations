export type Role = "student" | "teacher" | "admin";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
};

export const homeFor = (role: Role) =>
  role === "admin" ? "/admin" : role === "teacher" ? "/teach" : "/dashboard";
