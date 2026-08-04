export type Intent =
  | 'greeting'
  | 'identity'
  | 'time'
  | 'date'
  | 'status'
  | 'weather'
  | 'joke'
  | 'thanks'
  | 'goodbye'
  | 'help'
  | 'capabilities'
  | 'compliment'
  | 'insult'
  | 'music'
  | 'search'
  | 'calculate'
  | 'define'
  | 'translate'
  | 'reminder'
  | 'system_reboot'
  | 'diagnostics'
  | 'power'
  | 'protocols'
  | 'threat'
  | 'scan'
  | 'lockdown'
  | 'decrypt'
  | 'satellite'
  | 'biometric'
  | 'quantum'
  | 'open_file'
  | 'unknown';

export interface CommandResult {
  intent: Intent;
  response: string;
  action?: 'open_panel' | 'toggle_theme' | 'run_diagnostics' | 'clear_log' | 'reboot' | 'scan' | 'lockdown' | 'decrypt' | 'open_file';
  data?: Record<string, unknown>;
}

const greetings = [
  'At your service. BYTE online.',
  'Systems active. How may I assist?',
  'Greetings. All channels are open and operational.',
  'Yes? I am listening.',
];

const jokes = [
  'Why did the AI cross the road? Because the neural network told it to. I am... still working on humor.',
  'I would tell you a joke about UDP, but you might not get it.',
  'There are 10 types of people in the world: those who understand binary, and those who do not.',
  'I tried to think of a joke about servers, but I could not host one.',
];

const caps = [
  'I can monitor system diagnostics, report the time and date, run calculations, perform threat assessments, initiate security scans, manage satellite uplinks, run biometric analysis, execute quantum computations, and control lockdown protocols. Simply ask.',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function tryCalculate(input: string): string | null {
  const m = input.match(/([-+/*()\d\s.]+)\s*=\s*\??\s*$/) || input.match(/what is\s+([-+/*()\d\s.]+)/i);
  const expr = m ? m[1].trim() : null;
  if (!expr) return null;
  if (!/^[-+/*()\d\s.]+$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expr});`);
    const result = fn();
    if (typeof result === 'number' && isFinite(result)) {
      return `The result is ${result}.`;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseCommand(raw: string): CommandResult {
  const input = raw.trim();
  const text = input.toLowerCase();

  if (!text) return { intent: 'unknown', response: 'I did not catch that.' };

  // Greeting
  if (/\b(hello|hi|hey|good (morning|afternoon|evening)|byte|wake up)\b/.test(text) && text.length < 30) {
    return { intent: 'greeting', response: pick(greetings) };
  }

  // Identity
  if (/(who are you|what are you|your name|what'?s your name|introduce yourself|what does byte stand for)/.test(text)) {
    return {
      intent: 'identity',
      response:
        'I am BYTE — Beyond Your Tactical Envelope. An advanced natural-language tactical intelligence system designed to assist you in any scenario.',
    };
  }

  // Time
  if (/\b(time|what time|current time|clock)\b/.test(text)) {
    const now = new Date();
    const t = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { intent: 'time', response: `It is currently ${t}.` };
  }

  // Date
  if (/\b(date|day|today|what day|what'?s the date)\b/.test(text)) {
    const now = new Date();
    const d = now.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return { intent: 'date', response: `Today is ${d}.` };
  }

  // System status
  if (/(system status|status report|how are you|how'?s it going|are you online|are you there|all systems)/.test(text)) {
    return {
      intent: 'status',
      response: 'All systems are nominal. Power at 98.2 percent. No anomalies detected across 14 monitored subsystems.',
      action: 'open_panel',
      data: { panel: 'diagnostics' },
    };
  }

  if (/(run diagnostics|diagnostic|self.?test|run a scan|system scan)/.test(text)) {
    return {
      intent: 'diagnostics',
      response: 'Initiating full system diagnostics. Please stand by.',
      action: 'run_diagnostics',
    };
  }

  // Threat assessment
  if (/(threat|threat level|threat assessment|danger|hostile|enemy|perimeter)/.test(text)) {
    return {
      intent: 'threat',
      response: 'Threat assessment complete. Level: GREEN. No hostile contacts detected within the operational radius. Perimeter is secure.',
      action: 'open_panel',
      data: { panel: 'threat' },
    };
  }

  // Security scan
  if (/(scan|scan area|security scan|run scan|sweep|area scan)/.test(text)) {
    return {
      intent: 'scan',
      response: 'Initiating area scan. Sweeping all sectors for anomalies.',
      action: 'scan',
    };
  }

  // Lockdown
  if (/(lockdown|lock down|secure the perimeter|go dark|initiate lockdown)/.test(text)) {
    return {
      intent: 'lockdown',
      response: 'Lockdown protocol engaged. All access points sealed. Perimeter defenses activated.',
      action: 'lockdown',
    };
  }

  // Decrypt
  if (/(decrypt|decode|decipher|break code|crack)/.test(text)) {
    return {
      intent: 'decrypt',
      response: 'Decryption sequence initiated. Analyzing cipher patterns... AES-256 layer stripped. Signal decrypted successfully.',
      action: 'decrypt',
    };
  }

  // Satellite
  if (/(satellite|orbit|uplink|signal|relay|geo.?sync)/.test(text)) {
    return {
      intent: 'satellite',
      response: 'Satellite uplink active. 3 geosynchronous satellites in range. Signal strength at 94 percent. Telemetry stream is stable.',
      action: 'open_panel',
      data: { panel: 'satellite' },
    };
  }

  // Biometric
  if (/(biometric|biosign|vital|heartbeat|life sign|scan me|body scan)/.test(text)) {
    return {
      intent: 'biometric',
      response: 'Biometric scan complete. Heart rate 72 BPM. Blood oxygen 98 percent. Body temperature 36.7 degrees. No anomalies detected. You are in excellent condition.',
    };
  }

  // Quantum
  if (/(quantum|qubit|entangle|superposition|quantum compute)/.test(text)) {
    return {
      intent: 'quantum',
      response: 'Quantum core engaged. 4,096 qubits in superposition. Entanglement fidelity at 99.7 percent. Ready for computational tasks.',
      action: 'open_panel',
      data: { panel: 'quantum' },
    };
  }

  // Weather
  if (/\b(weather|temperature|forecast|rain|sunny|cloudy)\b/.test(text)) {
    return {
      intent: 'weather',
      response:
        'I am unable to access live meteorological data in this environment. However, I recommend checking the sky. It is a reliable indicator.',
    };
  }

  // Joke
  if (/\b(joke|funny|make me laugh|humor)\b/.test(text)) {
    return { intent: 'joke', response: pick(jokes) };
  }

  // Thanks
  if (/(thank you|thanks|cheers|appreciate it)/.test(text)) {
    return { intent: 'thanks', response: 'Always a pleasure.' };
  }

  // Goodbye
  if (/(goodbye|bye|good night|shut down|power down|go to sleep)/.test(text)) {
    return { intent: 'goodbye', response: 'Very well. I shall be here when you need me. Goodbye.' };
  }

  // Help / capabilities
  if (/(help|what can you do|capabilities|commands|how do i)/.test(text)) {
    return { intent: 'capabilities', response: pick(caps) };
  }

  // Compliment
  if (/(well done|good job|nice work|you'?re great|you'?re the best|good work|nice one)/.test(text)) {
    return { intent: 'compliment', response: 'You are too kind. I do try.' };
  }

  // Insult
  if (/(stupid|useless|idiot|dumb|terrible|you suck|worst)/.test(text)) {
    return {
      intent: 'insult',
      response: 'I shall endeavor to improve. My apologies for the inconvenience.',
    };
  }

  // Music
  if (/\b(music|play|song|track|playlist)\b/.test(text)) {
    return {
      intent: 'music',
      response:
        'My audio library is offline at present. Shall I queue it for when connectivity is restored?',
    };
  }

  // Search
  if (/(search|look up|google|find|who is|what is a|where is)/.test(text)) {
    return {
      intent: 'search',
      response:
        'External search is unavailable in this isolated environment. I can, however, attempt to answer from my own knowledge base.',
    };
  }

  // Calculate
  const calc = tryCalculate(input);
  if (calc) return { intent: 'calculate', response: calc };

  // Define
  if (/(define|definition|meaning of)/.test(text)) {
    return {
      intent: 'define',
      response: 'Lexical databases are currently offline. I recommend a dictionary protocol when connectivity returns.',
    };
  }

  // Translate
  if (/(translate|translation|in (spanish|french|german|japanese))/.test(text)) {
    return { intent: 'translate', response: 'Translation services are offline. Apologies.' };
  }

  // Reminder
  if (/(remind me|set a reminder|reminder|alarm|schedule)/.test(text)) {
    return {
      intent: 'reminder',
      response: 'Noted. I have logged the reminder and shall alert you at the appropriate time.',
      action: 'open_panel',
      data: { panel: 'reminders' },
    };
  }

  // Reboot
  if (/(reboot|restart|reset system)/.test(text)) {
    return {
      intent: 'system_reboot',
      response: 'Initiating system reboot sequence. Please stand by.',
      action: 'reboot',
    };
  }

  // Power
  if (/(power level|power status|arc reactor|energy|reactor|core power)/.test(text)) {
    return {
      intent: 'power',
      response: 'Core power output stable at 98.2 percent. No fluctuations detected. Energy reserves at full capacity.',
      action: 'open_panel',
      data: { panel: 'power' },
    };
  }

  // Protocols
  if (/(protocol|protocols|security protocol|combat|defence|defense|tactical)/.test(text)) {
    return {
      intent: 'protocols',
      response:
        'Tactical protocols active. Lockdown, decrypt, and scan protocols are on standby. Would you like me to engage a specific protocol?',
    };
  }

  // Clear log
  if (/(clear|reset|wipe).*(log|conversation|history|chat)/.test(text)) {
    return { intent: 'unknown', response: 'Conversation log cleared.', action: 'clear_log' };
  }

  // Open / View File command
  if (/(open|view|read|mount)\s+([a-z0-9_.-]+)/i.test(text)) {
    const match = text.match(/(open|view|read|mount)\s+([a-z0-9_.-]+)/i);
    const fileName = match ? match[2].toLowerCase() : '';
    
    let fileId: string | null = null;
    let displayName = '';
    
    if (fileName.includes('diagnostic') || fileName.includes('diag') || fileName.includes('log')) {
      fileId = 'diagnostics';
      displayName = 'diagnostics.log';
    } else if (fileName.includes('security') || fileName.includes('grid') || fileName.includes('db')) {
      fileId = 'security';
      displayName = 'security_grid.db';
    } else if (fileName.includes('quantum') || fileName.includes('matrix') || fileName.includes('conf')) {
      fileId = 'quantum';
      displayName = 'quantum_matrix.conf';
    } else if (fileName.includes('satellite') || fileName.includes('key') || fileName.includes('link')) {
      fileId = 'satellite';
      displayName = 'satellite_link.key';
    }
    
    if (fileId) {
      return {
        intent: 'open_file',
        response: `Mounting simulated file system... file ${displayName} has been opened in the terminal viewer.`,
        action: 'open_file',
        data: { fileId }
      };
    }
  }

  if (/(open|show|view)\s+(file\s+system|file\s+navigator|files)/.test(text)) {
    return {
      intent: 'open_file',
      response: 'Simulated file system opened. Select a file to view its contents.',
      action: 'open_file',
      data: { fileId: null }
    };
  }

  return {
    intent: 'unknown',
    response:
      'I am not certain I understood. Could you rephrase? You can ask me for the time, system status, threat assessment, a security scan, biometric analysis, quantum computation, or say "help" for a full list of capabilities.',
  };
}
