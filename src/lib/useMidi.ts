import { useEffect, useRef, useCallback, useState } from 'react';

interface MidiEvent {
  type: 'noteon' | 'noteoff' | 'cc';
  note: number;
  velocity: number;
  channel: number;
  controller?: number;
  value?: number;
}

interface UseMidiOptions {
  onNoteOn?: (note: number, velocity: number, channel: number) => void;
  onNoteOff?: (note: number, channel: number) => void;
  onCC?: (controller: number, value: number, channel: number) => void;
}

export function useMidi(options: UseMidiOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<MidiEvent | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let inputs: WebMidi.MIDIInput[] = [];

    async function connect() {
      try {
        const midi = await navigator.requestMIDIAccess();

        function handleMessage(e: WebMidi.MIDIMessageEvent) {
          const [status, data1, data2] = e.data;
          const channel = status & 0x0f;
          const command = status >> 4;

          if (command === 9 && data2 > 0) {
            // Note On
            const event: MidiEvent = { type: 'noteon', note: data1, velocity: data2, channel };
            setLastEvent(event);
            optionsRef.current.onNoteOn?.(data1, data2, channel);
          } else if (command === 8 || (command === 9 && data2 === 0)) {
            // Note Off
            const event: MidiEvent = { type: 'noteoff', note: data1, velocity: 0, channel };
            setLastEvent(event);
            optionsRef.current.onNoteOff?.(data1, channel);
          } else if (command === 11) {
            // Control Change
            const event: MidiEvent = { type: 'cc', note: 0, velocity: 0, channel, controller: data1, value: data2 };
            setLastEvent(event);
            optionsRef.current.onCC?.(data1, data2, channel);
          }
        }

        // Connect to all inputs
        midi.inputs.forEach(input => {
          input.onmidimessage = handleMessage;
          inputs.push(input);
          setDeviceName(input.name || 'MIDI Device');
          setConnected(true);
        });

        // Listen for new connections
        midi.onstatechange = () => {
          midi.inputs.forEach(input => {
            if (!inputs.includes(input)) {
              input.onmidimessage = handleMessage;
              inputs.push(input);
              setDeviceName(input.name || 'MIDI Device');
              setConnected(true);
            }
          });
        };

        if (midi.inputs.size === 0) {
          setConnected(false);
          setDeviceName(null);
        }
      } catch {
        setConnected(false);
      }
    }

    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      connect();
    }

    return () => {
      inputs.forEach(input => { input.onmidimessage = null; });
    };
  }, []);

  return { connected, deviceName, lastEvent };
}
