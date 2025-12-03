// apps/web/src/components/ui/Badge.tsx
import React from "react";
import { colors, radii, spacing, typography } from "../../design/tokens";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge: React.FC<BadgeProps> = ({ variant = "default", children, style, ...rest }) => {
  let bg = colors.bgSubtle;
  let color = colors.textSecondary;
  let borderColor = "transparent";

  switch (variant) {
    case "success":
      bg = colors.successSoft;
      color = colors.success;
      break;
    case "warning":
      bg = colors.warningSoft;
      color = colors.warning;
      break;
    case "danger":
      bg = colors.dangerSoft;
      color = colors.danger;
      break;
    case "info":
      bg = colors.infoSoft;
      color = colors.info;
      break;
    case "outline":
      bg = "transparent";
      color = colors.textSecondary;
      borderColor = colors.borderStrong;
      break;
    case "default":
    default:
      bg = colors.bgSubtle;
      color = colors.textSecondary;
      break;
  }

  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: radii.full,
        backgroundColor: bg,
        color,
        border: borderColor === "transparent" ? "none" : `1px solid ${borderColor}`,
        fontFamily: typography.fontFamily,
        fontSize: typography.fontSize.xs,
        fontWeight: typography.fontWeight.medium,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
};

