import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  shortcut?: string;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
  icon: 'btn-icon',
};

export default function Button({
  variant = 'primary',
  shortcut,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type="button" className={`${variantClass[variant]} ${className}`} {...props}>
      {children}
      {shortcut ? <kbd className="btn-shortcut">{shortcut}</kbd> : null}
    </button>
  );
}
