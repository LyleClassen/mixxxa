import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	DialogClose,
} from "@/components/ui/dialog";

function App() {
	const [count, setCount] = useState(0);

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-8">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>shadcn + Base UI + Electrobun</CardTitle>
					<CardDescription>
						shadcn-style components powered by{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
							@base-ui-components/react
						</code>{" "}
						and Tailwind v4.
					</CardDescription>
				</CardHeader>

				<CardContent className="space-y-4">
					<div>
						<p className="mb-3 text-sm text-muted-foreground">
							Counter — React state survives HMR.
						</p>
						<div className="flex items-center gap-3">
							<Button onClick={() => setCount((c) => c + 1)}>
								Count: {count}
							</Button>
							<Button variant="outline" onClick={() => setCount(0)}>
								Reset
							</Button>
						</div>
					</div>
				</CardContent>

				<CardFooter className="gap-2">
					<Dialog>
						<DialogTrigger render={<Button variant="secondary" />}>
							Open Dialog
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Base UI Dialog</DialogTitle>
								<DialogDescription>
									This dialog is built on{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
										@base-ui-components/react/dialog
									</code>
									. Focus is trapped, Escape closes it, and the backdrop
									dismisses it.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<DialogClose render={<Button variant="outline" />}>
									Close
								</DialogClose>
								<Button>Confirm</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</CardFooter>
			</Card>
		</div>
	);
}

export default App;
