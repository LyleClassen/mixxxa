import { Dialog as BaseDialog } from "@base-ui-components/react/dialog";
import type { ReactNode } from "react";

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: ReactNode;
}

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange}>
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className="fixed inset-0 bg-black/60 z-40" />
				<BaseDialog.Popup className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-lg bg-gray-900 border border-gray-700 p-6 shadow-xl">
					<BaseDialog.Title className="text-lg font-semibold text-white mb-4">
						{title}
					</BaseDialog.Title>
					{children}
				</BaseDialog.Popup>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
}
