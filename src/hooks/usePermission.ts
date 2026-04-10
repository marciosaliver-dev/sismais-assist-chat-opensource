import { useAuth } from "@/contexts/AuthContext";
import type { RolePermissions } from "@/types/auth";

export function usePermission(permission: keyof RolePermissions): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}

export function usePermissions(permissions: (keyof RolePermissions)[]): boolean[] {
  const { hasPermission } = useAuth();
  return permissions.map((p) => hasPermission(p));
}
