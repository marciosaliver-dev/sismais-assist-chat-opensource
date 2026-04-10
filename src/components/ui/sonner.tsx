import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import React from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:border-[hsl(0,84%,60%)]/30 group-[.toaster]:text-destructive",
          success: "group-[.toaster]:border-[hsl(160,84%,39%)]/30 group-[.toaster]:text-[hsl(160,84%,39%)]",
        },
      }}
      icons={{
        error: React.createElement(AlertTriangle, { className: "w-5 h-5 text-destructive animate-pulse-subtle" }),
        success: React.createElement(CheckCircle2, { className: "w-5 h-5 text-[hsl(160,84%,39%)] animate-bounce-subtle" }),
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
