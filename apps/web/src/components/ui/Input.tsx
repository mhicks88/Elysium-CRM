// apps/web/src/components/ui/Input.tsx
import React from "react";
import {
  colors,
  radii,
  spacing,
  typography,
  transitions,
} from "../../design/tokens";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /**
   * Show a visual indicator that this field is required.
   * This is purely presentational; use the normal `required`
   * attribute to enforce HTML validation.
   */
  requiredLabel?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  style,
  requiredLabel,
  ...rest
}) => {
  const hasError = Boolean(error);

  return (
    <label style={{ display: "block", width: "100%" }}>
      {label && (
        <div
          style={{
            marginBottom: spacing.xs,
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.sm,
            color: colors.textSecondary,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>{label}</span>
          {requiredLabel && (
            <span
              style={{
                color: colors.danger,
                fontSize: typography.fontSize.sm,
              }}
            >
              *
            </span>
          )}
        </div>
      )}
      <input
        {...rest}
        style={{
          width: "100%",
          padding: `${spacing.sm}px ${spacing.md}px`,
          borderRadius: radii.md,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: hasError ? colors.danger : colors.borderStrong,
          backgroundColor: colors.bgSubtle,
          color: colors.textPrimary,
          fontFamily: typography.fontFamily,
          fontSize: typography.fontSize.base,
          lineHeight: typography.lineHeight.normal,
          outline: "none",
          transition: `border-color ${transitions.base}, box-shadow ${transitions.base}, background-color ${transitions.base}`,
          boxShadow: "none",
          ...style,
        }}
        onFocus={(e) => {
          if (rest.onFocus) rest.onFocus(e);
        }}
      />
      {(hint || error) && (
        <div
          style={{
            marginTop: spacing.xs,
            fontFamily: typography.fontFamily,
            fontSize: typography.fontSize.xs,
            color: hasError ? colors.danger : colors.textMuted,
          }}
        >
          {error || hint}
        </div>
      )}
    </label>
  );
};

