// apps/web/src/components/ui/Button.tsx
import React from "react";
import { colors, radii, spacing, typography, shadows, transitions } from "../../design/tokens";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  fullWidth,
  leftIcon,
  rightIcon,
  children,
  style,
  disabled,
  ...rest
}) => {
  const basePaddingY = size === "sm" ? spacing.xs : size === "lg" ? spacing.lg : spacing.sm;
  const basePaddingX = size === "sm" ? spacing.sm : size === "lg" ? spacing.xl : spacing.lg;
  const fontSize =
    size === "sm"
      ? typography.fontSize.sm
      : size === "lg"
      ? typography.fontSize.lg
      : typography.fontSize.base;

  // Variant styles
  let background = "transparent";
  let color = colors.textPrimary;
  let borderColor = colors.borderStrong;

  switch (variant) {
    case "primary":
      background = colors.primary;
      borderColor = colors.primary;
      color = colors.textPrimary;
      break;
    case "secondary":
      background = colors.bgSubtle;
      borderColor = colors.borderStrong;
      color = colors.textSecondary;
      break;
    case "ghost":
      background = "transparent";
      borderColor = "transparent";
      color = colors.textSecondary;
      break;
    case "danger":
      background = colors.danger;
      borderColor = colors.danger;
      color = colors.textPrimary;
      break;
  }

  const opacity = disabled ? 0.5 : 1;
  const cursor = disabled ? "not-allowed" : "pointer";

  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        padding: `${basePaddingY}px ${basePaddingX}px`,
        width: fullWidth ? "100%" : undefined,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor,
        background,
        color,
        fontFamily: typography.fontFamily,
        fontSize,
        fontWeight: typography.fontWeight.medium,
        lineHeight: typography.lineHeight.snug,
        boxShadow: shadows.sm,
        transition: `background-color ${transitions.base}, box-shadow ${transitions.base}, transform ${transitions.fast}, border-color ${transitions.base}, opacity ${transitions.base}`,
        cursor,
        opacity,
        // let callers override
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled && rest.onMouseDown) rest.onMouseDown(e);
      }}
      onClick={rest.onClick}
      onMouseEnter={rest.onMouseEnter}
      onMouseLeave={rest.onMouseLeave}
      onFocus={rest.onFocus}
      onBlur={rest.onBlur}
    >
      {leftIcon && <span style={{ display: "inline-flex", alignItems: "center" }}>{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span style={{ display: "inline-flex", alignItems: "center" }}>{rightIcon}</span>}
    </button>
  );
};

