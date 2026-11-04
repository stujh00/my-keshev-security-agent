import test from 'node:test';
import assert from 'node:assert/strict';
import {cpuEnvironment,getOllamaProgram} from './Start-Keshev-CPU-AI.mjs';
test('CPU overrides are present even if GPU was enabled',()=>{const e=cpuEnvironment({CUDA_VISIBLE_DEVICES:'0',OLLAMA_VULKAN:'true'});assert.equal(e.CUDA_VISIBLE_DEVICES,'-1');assert.equal(e.OLLAMA_VULKAN,'false');assert.equal(e.GGML_VK_VISIBLE_DEVICES,'-1');assert.equal(e.OLLAMA_NO_CLOUD,'1');assert.equal(e.OLLAMA_HOST,'127.0.0.1:11434')});
test('does not mutate input environment',()=>{const e={OLLAMA_VULKAN:'true'};cpuEnvironment(e);assert.equal(e.OLLAMA_VULKAN,'true')});
test('resolves installed executable path',()=>{const e={LOCALAPPDATA:'C:\\Users\\User\\AppData\\Local'};const p=getOllamaProgram(e, x=>x.endsWith('ollama.exe'));assert.ok(p.toLowerCase().endsWith('ollama.exe'))});
