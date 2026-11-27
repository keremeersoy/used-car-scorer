// TEMPORARY access probe (plan Task 1). Task 11 replaces this file.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

async function probe(): Promise<string> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return 'No active tab';
  const url = tab.url ?? '(URL not visible)';
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML.length,
    });
    return `OK\nURL: ${url}\nHTML length: ${injection?.result}`;
  } catch (error) {
    return `ERROR\nURL: ${url}\n${error instanceof Error ? error.message : String(error)}`;
  }
}

function Probe() {
  const [log, setLog] = useState<string[]>([]);
  const run = async () => {
    const line = `${new Date().toLocaleTimeString('tr-TR')} ${await probe()}`;
    setLog((previous) => [line, ...previous]);
  };
  return (
    <main style={{ font: '13px system-ui', padding: 12 }}>
      <button onClick={() => void run()}>Probe</button>
      {log.map((line, index) => (
        <pre key={log.length - index} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {line}
        </pre>
      ))}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Probe />);
