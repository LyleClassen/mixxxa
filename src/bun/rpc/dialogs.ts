import { Utils } from "electrobun/bun";

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
};
