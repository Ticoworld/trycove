import type {NextConfig} from 'next';
import {PHASE_DEVELOPMENT_SERVER} from 'next/constants';

export default function config(phase: string): NextConfig {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? (process.env.TRYCOVE_DEV_DIST_DIR || '.next') : '.next-production',
    serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  };
}
