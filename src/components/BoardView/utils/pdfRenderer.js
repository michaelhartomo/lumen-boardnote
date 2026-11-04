import * as pdfjsLib from 'pdfjs-dist';
import pdf_worker_url from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdf_worker_url;

export { pdfjsLib };
export default pdfjsLib;
