# AI Coding Rules & Project Standards

## Tech Stack
- **Frontend Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS for utility-first styling.
- **UI Components**: shadcn/ui (Radix UI primitives) for consistent, accessible components.
- **Routing**: React Router DOM v6 for client-side navigation.
- **State Management & Data Fetching**: TanStack Query (React Query) v5 for server state.
- **Backend/Database**: Supabase (PostgreSQL, Auth, Edge Functions).
- **Form Handling**: React Hook Form with Zod for schema validation.
- **Icons**: Lucide React.
- **Testing**: Vitest for unit and integration tests.

## Library & Development Rules

### 1. UI & Styling
- **Components**: Always prefer using existing components in `src/components/ui/`. If a new component is needed, check if it's available in shadcn/ui first.
- **Tailwind**: Use Tailwind CSS classes for all styling. Avoid custom CSS files unless absolutely necessary (like global resets or complex animations).
- **Icons**: Use `lucide-react` for all icons.

### 2. State & Data
- **Supabase**: Use the Supabase client located at `src/integrations/supabase/client.ts` for database and auth operations.
- **Data Fetching**: Use TanStack Query hooks (`useQuery`, `useMutation`) for all server-side data fetching to handle caching, loading states, and errors consistently.
- **Types**: Ensure all database interactions are typed using the generated Supabase types in `src/integrations/supabase/types.ts`.

### 3. Forms & Validation
- **Validation**: Use `zod` to define schemas for all forms and API payloads.
- **Implementation**: Use `react-hook-form` with the `@hookform/resolvers/zod` for form management.

### 4. Routing
- **Structure**: Maintain all application routes in `src/App.tsx`.
- **Navigation**: Use `Link` and `useNavigate` from `react-router-dom`.

### 5. Project Structure
- **Pages**: Store main route components in `src/pages/`.
- **Components**: Store reusable components in `src/components/`, organized by feature if necessary.
- **Hooks**: Store custom hooks in `src/hooks/`.
- **Services**: Complex business logic or external API wrappers (like WhatsApp services) should go in `src/services/`.
- **Types**: Define shared TypeScript interfaces and types in `src/types/`.

### 6. Code Quality
- **Type Safety**: Avoid using `any`. Define proper interfaces and types.
- **Simplicity**: Keep components small and focused. Follow the "one file, one responsibility" principle.
- **Edge Functions**: Business logic that requires server-side execution or sensitive keys should be placed in `supabase/functions/`.

### 7. Supabase Security (RLS)
- **RLS**: Always ensure Row Level Security is enabled on new tables.
- **Policies**: Create specific policies for authenticated users to ensure they can only access their own data.
