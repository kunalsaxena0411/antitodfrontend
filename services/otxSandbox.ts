
import { OtxSandboxReport } from '../types';

const OTX_SUBMIT_URL = 'https://otx.alienvault.com/api/v1/indicators/submit_file';
const OTX_ANALYSIS_URL = 'https://otx.alienvault.com/api/v1/indicators/file/';
const AUTH_KEY = '0a362f926e2147466eab52a66a24a55101f62a4acc1bf1c0db2a219fee304616';

interface SubmitResponse {
    result: string;
    status: string;
    sha256: string;
}

export const calculateFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const submitFileToSandbox = async (file: File): Promise<{ sha256: string, result: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const authHeader = 'Basic ' + btoa(`${AUTH_KEY}:${AUTH_KEY}`);
    
    // Direct upload to avoid proxy stripping multipart body
    const targetUrl = OTX_SUBMIT_URL;

    // Set a timeout for the upload to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s Timeout

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                // Do not set Content-Type; browser sets it with boundary for FormData
            },
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Upload failed (${response.status}): ${text.substring(0, 100)}`);
        }

        const data: SubmitResponse = await response.json();
        
        if (data.status === 'ok' && data.sha256) {
            return { sha256: data.sha256, result: data.result };
        } else {
            throw new Error('Invalid response from sandbox submission');
        }
    } catch (e: any) {
        if (e.name === 'AbortError') {
            throw new Error("Upload timed out (60s). The file may be too large or the network is slow.");
        }
        console.error("Sandbox Submission Error", e);
        throw e;
    }
};

export const getSandboxAnalysis = async (hash: string): Promise<OtxSandboxReport | null> => {
    const url = `${OTX_ANALYSIS_URL}${hash}/analysis`;
    // Direct fetch without proxy as per requirement
    const authHeader = 'Basic ' + btoa(`${AUTH_KEY}:${AUTH_KEY}`);

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': authHeader
            }
        });

        if (!response.ok) {
            if (response.status === 404 || response.status === 400) return null; // Not found/Not ready
            throw new Error(`Analysis fetch failed: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Validate it has basic structure
        if (data && data.analysis) {
            return data as OtxSandboxReport;
        }
        return null;
    } catch (e) {
        console.error("Sandbox Analysis Fetch Error", e);
        return null; // Return null to trigger retry/upload logic in UI
    }
};
