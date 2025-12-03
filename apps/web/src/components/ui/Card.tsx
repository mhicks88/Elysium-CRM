// apps/web/src/components/ui/Card.tsx
import React from "react";
import { colors, radii, spacing, shadows, typography } from "../../design/tokens";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  title?: string;
  subtitle?: string;
}

export const Card: React.FC<CardProps> = ({
  elevated = true,
  title,
  subtitle,
  children,
  style,
  ...rest
}) => {
  return (
    <div
      {...rest}
      style={{
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        padding: spacing.lg,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: elevated ? shadows.md : "none",
        ...style,
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: spacing.md }}>
          {title && (
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.lg,
                fontWeight: typography.fontWeight.semibold,
                color: colors.textPrimary,
                marginBottom: subtitle ? 4 : 0,
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              style={{
                fontFamily: typography.fontFamily,
                fontSize: typography.fontSize.sm,
                color: colors.textSecondary,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

