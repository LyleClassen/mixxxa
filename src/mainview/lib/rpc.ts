import { Electroview } from "electrobun/view";
import type { ElectrobunRPCSchema } from "electrobun/view";

export type MixxxaRPCSchema = ElectrobunRPCSchema & {
	bun: {
		requests: {
			openFileDialog: {
				params: { allowedFileTypes?: string };
				response: string | null;
			};
			readFile: {
				params: { path: string };
				response: string;
			};
			getAudioServerPort: {
				params: Record<string, never>;
				response: number;
			};
		};
		messages: Record<string, never>;
	};
	webview: {
		requests: Record<string, never>;
		messages: Record<string, never>;
	};
};

const rpc = Electroview.defineRPC<MixxxaRPCSchema>({
	handlers: {
		requests: {},
		messages: {},
	},
});

export const electroview = new Electroview({ rpc });
export { rpc };
