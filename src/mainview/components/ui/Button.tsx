import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
	primary: "bg-indigo-600 text-white hover:bg-indigo-700",
	secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
	ghost: "bg-transparent text-gray-300 hover:bg-white/10",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
}

export function Button({
	variant = "primary",
	className = "",
	...props
}: ButtonProps) {
	return (
		<button
			type="button"
			className={`inline-flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${variantClasses[variant]} ${className}`}
			{...props}
		/>
	);
}
