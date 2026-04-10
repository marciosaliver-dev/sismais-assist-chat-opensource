import { createContext, useContext, ReactNode } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { RolePermissions, UserRole } from "@/types/auth";
import { rolePermissions } from "@/types/auth";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active";
}

interface AuthContextType {
  user: AuthUser | null;
  permissions: RolePermissions | null;
  loading: boolean;
  isPending: boolean;
  logout: () => void;
  hasPermission: (permission: keyof RolePermissions) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: supabaseUser, loading: authLoading, signOut } = useSupabaseAuth();

  // Fetch user role and approval status from user_roles table
  const { data: userRoleData, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", supabaseUser?.id],
    queryFn: async () => {
      if (!supabaseUser?.id) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, is_approved")
        .eq("user_id", supabaseUser.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }
      return data as { role: UserRole; is_approved: boolean | null } | null;
    },
    enabled: !!supabaseUser?.id,
  });

  const loading = authLoading || (!!supabaseUser?.id && roleLoading);

  const role: UserRole = userRoleData?.role || "suporte";
  const isPending = !!supabaseUser && !loading && (userRoleData?.is_approved === false);

  const user: AuthUser | null = supabaseUser
    ? {
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.name || supabaseUser.email || "Usuário",
        email: supabaseUser.email || "",
        role,
        status: "active",
      }
    : null;

  const permissions = user && !isPending ? rolePermissions[user.role] : null;

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    if (!permissions) return false;
    return permissions[permission];
  };

  const logout = () => {
    signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, permissions, loading, isPending, logout, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
