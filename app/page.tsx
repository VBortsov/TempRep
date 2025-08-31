import path from "path";
import fs from "fs/promises";
import DraggableDocumentDock from "./DraggableDocumentDock";

async function getPdfFiles() {
    const pdfDir = path.join(process.cwd(), "public", "pdfs");
    try {
        const items = await fs.readdir(pdfDir, { withFileTypes: true });
        return items
            .filter(i => i.isFile() && i.name.toLowerCase().endsWith(".pdf"))
            .map(i => ({ name: i.name, url: `/pdfs/${i.name}` }));
    } catch {
        return [];
    }
}

export default async function Page() {
    const files = await getPdfFiles();

    return (
        <div
            className="w-screen h-screen overflow-hidden relative"
            style={{
                backgroundImage: "url(/images/bg.jpg)",  // ✅ local file
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            <div className="absolute inset-0 bg-black/10" />
            <DraggableDocumentDock
                title="Classified Documents"
                files={files}
                initial={{ x: 40, y: 60 }}
                width={320}
                height={380}
                rememberPosition
                constrainToViewport
            />
            <div className="absolute bottom-3 left-3 text-white/80 text-xs drop-shadow">
                Drag the header to move the panel. Click a file to open the PDF.
            </div>
        </div>
    );
}
