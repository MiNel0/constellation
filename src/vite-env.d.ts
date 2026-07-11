/// <reference types="vite/client" />
import type { ConstellationApi } from '../shared/types';
declare global { interface Window { constellation: ConstellationApi } }
export {};
