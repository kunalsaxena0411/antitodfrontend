
import React, { useCallback, useState } from 'react';
import { Upload, FileJson, AlertTriangle, Files, Database, BookOpen, DownloadCloud } from 'lucide-react';
import { parseJSONFile } from '../services/analyzer';
import { parseMalpediaActors, parseMalpediaMisp } from '../services/malpedia';
import { parseMitreStix } from '../services/mitre';
import { parseNvdCve } from '../services/cve';
import { LogEntry, MalpediaActor, CveEntry } from '../types';

interface UploadZoneProps {
  onDataLoaded: (data: LogEntry[]) => void;
  onMmdbLoaded: (files: File[]) => void;
  onMalpediaLoaded: (files: File[]) => void;
  onMalpediaActorsLoaded: (actors: MalpediaActor[]) => void;
  onCveLoaded: (cves: CveEntry[]) => void;
  onError: (msg: string) => void;
  onNotify: (msg: string, type: 'info' | 'success' | 'error') => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ 
    onDataLoaded, 
    onMmdbLoaded, 
    onMalpediaLoaded, 
    onMalpediaActorsLoaded, 
    onCveLoaded, 
    onError,
    onNotify 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    const jsonFiles = files.filter(f => f.type === 'application/json' || f.name.endsWith('.json'));
    const mmdbFiles = files.filter(f => f.name.endsWith('.mmdb'));
    const bibFiles = files.filter(f => f.name.endsWith('.bib'));

    if (jsonFiles.length === 0 && mmdbFiles.length === 0 && bibFiles.length === 0) {
      onNotify("Invalid file type. Accepted: JSON, MMDB, BIB.", 'error');
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    let failCount = 0;

    // Handle Malpedia .bib
    if (bibFiles.length > 0) {
        try {
            await onMalpediaLoaded(bibFiles);
            successCount++;
        } catch (e) {
            console.error(e);
            failCount++;
            onNotify("Failed to load Malpedia .bib file.", 'error');
        }
    }

    // Handle MMDBs
    if (mmdbFiles.length > 0) {
        try {
            await onMmdbLoaded(mmdbFiles);
            successCount++;
        } catch (e) {
            console.error(e);
            failCount++;
            onNotify("Failed to load MMDB file(s).", 'error');
        }
    }
    
    // Handle JSON (Logs, Malpedia Actors, MITRE STIX, or NVD CVE)
    if (jsonFiles.length > 0) {
        for (const file of jsonFiles) {
            try {
                const text = await file.text();
                let json;
                try {
                    json = JSON.parse(text);
                } catch (parseErr) {
                    throw new Error(`Invalid JSON in ${file.name}`);
                }

                if (Array.isArray(json)) {
                    // Likely Logs
                    const data = json as LogEntry[];
                    onDataLoaded(data);
                    successCount++;
                } else if (typeof json === 'object' && json !== null) {
                     // Check for NVD CVE
                     if (json.vulnerabilities && Array.isArray(json.vulnerabilities) && (json.format === 'NVD_CVE' || json.version)) {
                         const cves = await parseNvdCve(file);
                         onCveLoaded(cves);
                         successCount++;
                     }
                     // Check for STIX Bundle (MITRE)
                     else if (json.type === 'bundle' && Array.isArray(json.objects)) {
                         const actors = await parseMitreStix(file);
                         onMalpediaActorsLoaded(actors);
                         successCount++;
                     }
                     // Check for Malpedia MISP (Values array)
                     else if (json.values && Array.isArray(json.values) && json.values[0]?.uuid) {
                         const actors = await parseMalpediaMisp(file);
                         onMalpediaActorsLoaded(actors);
                         successCount++;
                     }
                     // Check for Malpedia Actors (Object map with UUIDs)
                     else if (Object.keys(json).length > 0 && json[Object.keys(json)[0]].uuid) {
                         const actors = await parseMalpediaActors(file);
                         onMalpediaActorsLoaded(actors);
                         successCount++;
                     } else {
                         // Fallback: Try as single log entry?
                         const data = [json as LogEntry];
                         onDataLoaded(data);
                         successCount++;
                     }
                }
            } catch (err) {
                console.error(err);
                failCount++;
                onNotify(`Failed to process ${file.name}. Check format.`, 'error');
            }
        }
    }

    setIsProcessing(false);

    if (failCount > 0 && successCount === 0) {
        // If everything failed, maybe use the main error state
        // onError("All uploads failed. Please check file formats.");
    } else if (successCount > 0) {
        onNotify(`Successfully processed ${successCount} file(s).`, 'success');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [onDataLoaded, onError]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 ease-in-out group
        flex flex-col items-center justify-center p-8 md:p-12 min-h-[40vh] md:min-h-[400px]
        ${isDragging 
          ? 'border-cyber-cyan bg-cyber-cyan/10 scale-[1.01] shadow-[0_0_30px_rgba(0,243,255,0.2)]' 
          : 'border-gray-700 hover:border-cyber-purple/50 bg-cyber-black/40'
        }
      `}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[linear-gradient(0deg,transparent_24%,rgba(0,243,255,.3)_25%,rgba(0,243,255,.3)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.3)_75%,rgba(0,243,255,.3)_76%,transparent_77%,transparent),linear-gradient(90deg,transparent_24%,rgba(0,243,255,.3)_25%,rgba(0,243,255,.3)_26%,transparent_27%,transparent_74%,rgba(0,243,255,.3)_75%,rgba(0,243,255,.3)_76%,transparent_77%,transparent)] bg-[length:30px_30px]"></div>

      <div className="z-10 flex flex-col items-center text-center space-y-6 w-full">
        <div className={`
          w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center 
          transition-all duration-500
          ${isDragging ? 'bg-cyber-cyan text-black shadow-[0_0_20px_#00f3ff]' : 'bg-gray-800 text-cyber-cyan'}
          ${isProcessing ? 'animate-spin' : ''}
        `}>
          {isProcessing ? (
            <div className="w-8 h-8 md:w-10 md:h-10 border-4 border-black border-t-transparent rounded-full"></div>
          ) : (
            <div className="relative">
              <Upload className="w-8 h-8 md:w-10 md:h-10" />
              {isDragging && <BookOpen className="w-5 h-5 md:w-6 md:h-6 absolute -bottom-2 -right-2 text-cyber-purple animate-bounce" />}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-cyber font-bold text-white">
            {isProcessing ? `PROCESSING DATA...` : 'INITIATE UPLOAD'}
          </h3>
          <p className="text-gray-400 font-mono text-xs md:text-sm max-w-xs md:max-w-md mx-auto">
            Drag & Drop JSON Logs, MaxMind (.mmdb), Malpedia (.bib), NVD CVE JSON, or MITRE STIX.
            <br/>
            <span className="text-xs text-cyber-purple">Secure, client-side processing.</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-lg px-4">
            <label className="relative group cursor-pointer flex-1 min-w-[160px]">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyber-cyan to-cyber-purple rounded blur opacity-30 group-hover:opacity-75 transition duration-200"></div>
                <div className="relative px-4 py-3 bg-black rounded leading-none flex items-center justify-center h-full">
                    <span className="text-cyber-cyan group-hover:text-white transition duration-200 font-mono font-bold text-sm md:text-base">
                    BROWSE FILES
                    </span>
                </div>
                <input 
                    type="file" 
                    className="hidden" 
                    accept=".json,.mmdb,.bib"
                    multiple
                    onChange={handleFileInput}
                    disabled={isProcessing}
                />
            </label>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyber-cyan"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyber-cyan"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyber-cyan"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyber-cyan"></div>
    </div>
  );
};
