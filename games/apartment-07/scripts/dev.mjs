import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const children=[['node_modules/tsx/dist/cli.mjs','watch','server/index.ts'],['node_modules/vite/bin/vite.js','--host','127.0.0.1']].map(args=>spawn(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true}));
const stop=()=>{for(const c of children)c.kill();};process.on('SIGINT',()=>{stop();process.exit();});process.on('SIGTERM',()=>{stop();process.exit();});for(const c of children)c.on('exit',code=>{stop();process.exit(code??0);});
