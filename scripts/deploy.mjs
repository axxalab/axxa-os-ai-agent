// scripts/deploy.mjs
// Copia os 3 arquivos de /output para a pasta de plugins do Vault Obsidian.
// Substitui o `cp` Unix do prompt original — funciona em Windows, macOS e Linux.

import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = ".axxa.local.json";
const PLUGIN_FOLDER = "axxa-os-ai-agent";
const FILES = ["main.js", "manifest.json", "styles.css"];

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`
[deploy] ${CONFIG_FILE} não encontrado.

Crie esse arquivo na raiz do projeto com o caminho do seu Vault:

  {
    "vaultPath": "C:\\\\Users\\\\rafae\\\\Obsidian\\\\MeuVault"
  }

(Esse arquivo é local — está no .gitignore e não vai pro repo.)
`);
    process.exit(1);
  }
  const raw = fs.readFileSync(CONFIG_FILE, "utf8");
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    console.error(`[deploy] ${CONFIG_FILE} não é um JSON válido: ${err.message}`);
    process.exit(1);
  }
  if (!config.vaultPath) {
    console.error(`[deploy] "vaultPath" não definido em ${CONFIG_FILE}.`);
    process.exit(1);
  }
  if (!fs.existsSync(config.vaultPath)) {
    console.error(`[deploy] vaultPath não existe: ${config.vaultPath}`);
    process.exit(1);
  }
  return config;
}

function copyToVault(vaultPath) {
  const targetDir = path.join(vaultPath, ".obsidian", "plugins", PLUGIN_FOLDER);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of FILES) {
    const src = path.join("output", file);
    const dest = path.join(targetDir, file);
    if (!fs.existsSync(src)) {
      console.error(`[deploy] ${src} não existe. Rode 'npm run build' primeiro.`);
      process.exit(1);
    }
    fs.copyFileSync(src, dest);
    console.log(`[deploy] ${file} -> ${dest}`);
  }
  return targetDir;
}

const config = readConfig();
const targetDir = copyToVault(config.vaultPath);
console.log(`\n[deploy] Concluído em ${targetDir}`);
console.log("[deploy] Reative o plugin no Obsidian: Settings -> Community Plugins -> toggle off/on.");
