const llamaCppModule = require("@llama-node/llama-cpp");
const { LLama } = llamaCppModule;
const { LlamaModel, LlamaContext, LlamaChatSession } = require("llama-node");

const llama = new LlamaModel(LLama);

const config = {
  modelPath: "./models/phi-2.Q4_K_M.gguf",
  gpuLayers: 0, // 0 = CPU only (cross platform!)
  nCtx: 2048,   // Context length
};

async function loadModel() {
  await llama.load(config);
  console.log(' Model loaded!');
}

async function askLlama(promptText) {
  const context = new LlamaContext({ model: llama });
  const session = new LlamaChatSession({ context });

  const result = await session.prompt(promptText);
  return result;
}

module.exports = { loadModel, askLlama };