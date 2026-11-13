import { contextBridge } from 'electron';

// The typed GameApi is exposed in Task 18.
contextBridge.exposeInMainWorld('skyempire', { version: '0.1.0' });
