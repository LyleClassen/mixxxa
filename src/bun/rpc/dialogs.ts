import { Utils } from "electrobun/bun";
import { checkToolchain } from "../analysis/binaries";
import type { ToolchainStatus } from "../../shared/types";

export const dialogsHandlers = {
  openXmlFile: async (): Promise<string | null> => {
    const files = await Utils.openFileDialog({
      allowedFileTypes: "xml",
      canChooseFiles: true,
      canChooseDirectory: false,
      allowsMultipleSelection: false,
    });
    if (!files || files.length === 0 || files[0] === "") return null;
    return Bun.file(files[0]).text();
  },
  openFolder: async (): Promise<string | null> => {
    const files = await Utils.openFileDialog({
      canChooseFiles: false,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    });
    if (!files || files.length === 0 || files[0] === "") return null;
    return files[0];
  },
  getToolchainStatus: async (): Promise<ToolchainStatus> => {
    return checkToolchain();
  },
};
