class Client {
    constructor(options = {}) {
        this.defaultModel = options.defaultModel || null;
        if (options.baseUrl) {
            this.baseUrl = options.baseUrl;
            this.apiEndpoint = `${this.baseUrl}/chat/completions`
            this.imageEndpoint = `${this.baseUrl}/images/generations`
        } else {
            this.baseUrl = 'https://text.pollinations.ai';
            this.apiEndpoint = `${this.baseUrl}/openai`;
            this.imageEndpoint = `https://image.pollinations.ai/prompt/{prompt}`;
            this.referrer = options.referrer || 'https://g4f.dev';
            if (typeof process !== 'undefined' && process.env.POLLINATIONS_API_KEY) {
                options.apiKey = process.env.POLLINATIONS_API_KEY;
            }
        }
        this.apiKey = options.apiKey;
        this.extraHeaders = {
            'Content-Type': 'application/json',
            ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
            ...(options.extraHeaders || {})
        };
        this.modelAliases = options.modelAliases || (!options.baseUrl ? {
          "deepseek-v3": "deepseek",
          "deepseek-r1": "deepseek-reasoning",
          "grok-3-mini-high": "grok",
          "llama-4-scout": "llamascout",
          "mistral-small-3.1": "mistral",
          "gpt-4.1-mini": "openai",
          "gpt-4o-audio": "openai-audio",
          "gpt-4.1-nano": "openai-fast",
          "gpt-4.1": "openai-large",
          "o3": "openai-reasoning",
          "gpt-4o-mini": "openai-roblox",
          "phi-4": "phi",
          "qwen2.5-coder": "qwen-coder",
          "gpt-4o-mini-search": "searchgpt",
          "gpt-image": "gptimage",
          "sdxl-turbo": "turbo",
        } : {});
        this.swapAliases = {}
        Object.keys(this.modelAliases).forEach(key => {
          this.swapAliases[this.modelAliases[key]] = key;
        });
    }

    get chat() {
        return {
            completions: {
            create: async (params) => {
                if (params.model && this.modelAliases[params.model]) {
                  params.model = this.modelAliases[params.model];
                } else if (!params.model && this.defaultModel) {
                  params.model = this.defaultModel;
                }
                if (this.referrer) {
                    params.referrer = this.referrer;
                }
                const requestOptions = {
                    method: 'POST',
                    headers: this.extraHeaders,
                    body: JSON.stringify(params)
                };

                if (params.stream) {
                    return this._streamCompletion(this.apiEndpoint, requestOptions);
                } else {
                    return this._regularCompletion(this.apiEndpoint, requestOptions);
                }
            }
            }
        };
    }

    get models() {
      return {
        list: async () => {
          const response = await fetch(`${this.baseUrl}/models`, {
            method: 'GET',
            headers: this.extraHeaders
          });
          
          if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.status}`);
          }

          let data = await response.json();
          data = data.data || data;
          data.forEach((model, index) => {
            if (!model.id) {
              model.id = this.swapAliases[model.name] || model.name;
              data[index] = model;
            }
          });
          return data;
        }
      };
    }

    get images() {
        return {
            generate: async (params) => {
                if (params.model && this.modelAliases[params.model]) {
                    params.model = this.modelAliases[params.model];
                }
                if (this.imageEndpoint.includes('{prompt}')) {
                    return this._defaultImageGeneration(params, { headers: this.extraHeaders });
                }
                return this._regularImageGeneration(params, { headers: this.extraHeaders });
            }
        };
    }

    async _regularCompletion(apiEndpoint, requestOptions) {
        const response = await fetch(apiEndpoint, requestOptions);

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        return await response.json();
    }

    async *_streamCompletion(apiEndpoint, requestOptions) {
      const response = await fetch(apiEndpoint, requestOptions);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming not supported in this environment');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n');
          buffer = parts.pop();

          for (const part of parts) {
            if (!part.trim()) continue;
            if (part === 'data: [DONE]') continue;

            try {
              if (part.startsWith('data: ')) {
                const data = JSON.parse(part.slice(6));
                yield data;
              }
            } catch (err) {
              console.error('Error parsing chunk:', part, err);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    _normalizeMessages(messages) {
      return messages.map(message => ({
        role: message.role,
        content: message.content
      }));
    }

    async _defaultImageGeneration(params, requestOptions) {
        params = {...params};
        let prompt = params.prompt ? params.prompt : '';
        prompt = encodeURIComponent(prompt.replaceAll(" ", "+"));
        delete params.prompt;
        if (params.nologo === undefined) {
            params.nologo = true;
        }
        if (params.size) {
            [params.width, params.height] = params.size.split('x');
            delete params.size;
        }
        const encodedParams = new URLSearchParams(params);
        let url = this.imageEndpoint.replace('{prompt}', prompt);
        url += '?' + encodedParams.toString();
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
            throw new Error(`Image generation request failed with status ${response.status}`);
        }

        return {data: [{url: response.url}]}
    }

    async _regularImageGeneration(params, requestOptions) {
        const response = await fetch(this.imageEndpoint, {
              method: 'POST',
              body: JSON.stringify(params),
              ...requestOptions
          });

        if (!response.ok) {
            throw new Error(`Image generation request failed with status ${response.status}`);
        }

        return await response.json();
    }
}

class DeepInfra extends Client {
    constructor(options = {}) {
        super({
            baseUrl: 'https://api.deepinfra.com/v1/openai',
            defaultModel: 'deepseek-ai/DeepSeek-V3-0324',
            ...options
        });
    }
}

class Together extends Client {
    constructor(options = {}) {
        super({
            baseUrl: 'https://api.together.xyz/v1',
            defaultModel: 'blackbox/meta-llama-3-1-8b',
            modelAliases: {
                "flux": "black-forest-labs/FLUX.1-schnell-Free",
                ...options.modelAliases
            },
            ...options
        });
    }

    async getApiKey() {
        if (!this.apiKey) {
            if (typeof process !== 'undefined' && process.env.TOGETHER_API_KEY) {
                this.apiKey = process.env.TOGETHER_API_KEY;
                return this.apiKey;
            }
            const activation_endpoint = "https://www.codegeneration.ai/activate-v2";
            const response = await fetch(activation_endpoint);
            if (!response.ok) {
                throw new Error(`Failed to fetch API key: ${response.status}`);
            }
            const data = await response.json();
            this.apiKey = data.openAIParams?.api_key;
        }
        return this.apiKey;
    }

    async _regularImageGeneration(params, requestOptions) {
        if (params.size) {
            [params.width, params.height] = params.size.split('x');
            delete params.size;
        }
        return super._regularImageGeneration(params, requestOptions);
    }
}

class Puter {
    constructor(options = {}) {
        this.defaultModel = options.defaultModel || 'gpt-4.1';
        this.puter = options.puter || this._injectPuter();
    }

    get chat() {
        return {
            completions: {
                create: async (params) => {
                    const { messages, ...options } = params;
                    if (!options.model && this.defaultModel) {
                        options.model = this.defaultModel;
                    }
                    if (options.stream) {
                        return this._streamCompletion(messages, options);
                    }
                    const response = await (await this.puter).ai.chat(messages, false, options);
                    if (response.choices == undefined && response.message !== undefined) {
                        return {
                            ...response,
                            get choices() {
                                return [{message: response.message}];
                            }
                        };
                    } else {
                        return response;
                    }
                }
            }
        };
    }

    get models() {
      return {
        list: async () => {
            const response = await fetch("https://api.puter.com/puterai/chat/models/");
            let models = await response.json();
            models = models.models;
            const blockList = ["abuse", "costly", "fake", "model-fallback-test-1"];
            models = models.filter((model) => !model.includes("/") && !blockList.includes(model));
            return models.map(model => {
                return {
                    id: model,
                    type: "chat"
                };
            });
        }
      };
    }

    async _injectPuter() {
        return new Promise((resolve, reject) => {
            if (typeof window === 'undefined') {
                reject(new Error('Puter can only be used in a browser environment'));
                return;
            }
            if (window.puter) {
                resolve(puter);
                return;
            }
            var tag = document.createElement('script');
            tag.src = "https://js.puter.com/v2/";
            tag.onload = () => {
                resolve(puter);
            }
            tag.onerror = reject;
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        });
    }

    async *_streamCompletion(messages, options = {}) {
        for await (const item of await ((await this.puter).ai.chat(messages, false, options))) {
          if (item.choices == undefined && item.text !== undefined) {
            yield {
                ...item,
                get choices() {
                    return [{delta: {content: item.text}}];
                }
            };
          } else {
            yield item
          }
        }
    }
}

class HuggingFace extends Client {
    constructor(options = {}) {
        if (!options.apiKey) {
            if (typeof process !== 'undefined' && process.env.HUGGINGFACE_API_KEY) {
                options.apiKey = process.env.HUGGINGFACE_API_KEY;
            } else {
                throw new Error("HuggingFace API key is required. Set it in the options or as an environment variable HUGGINGFACE_API_KEY.");
            }
        }
        super({
            baseUrl: 'https://api-inference.huggingface.co/v1',
            defaultModel: 'meta-llama/Meta-Llama-3-8B-Instruct',
            modelAliases: {
                // Chat //
                "llama-3": "meta-llama/Llama-3.3-70B-Instruct",
                "llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct",
                "command-r-plus": "CohereForAI/c4ai-command-r-plus-08-2024",
                "deepseek-r1": "deepseek-ai/DeepSeek-R1",
                "deepseek-v3": "deepseek-ai/DeepSeek-V3",
                "qwq-32b": "Qwen/QwQ-32B",
                "nemotron-70b": "nvidia/Llama-3.1-Nemotron-70B-Instruct-HF",
                "qwen-2.5-coder-32b": "Qwen/Qwen2.5-Coder-32B-Instruct",
                "llama-3.2-11b": "meta-llama/Llama-3.2-11B-Vision-Instruct",
                "mistral-nemo": "mistralai/Mistral-Nemo-Instruct-2407",
                "phi-3.5-mini": "microsoft/Phi-3.5-mini-instruct",
                "gemma-3-27b": "google/gemma-3-27b-it",
                // Image //
                "flux": "black-forest-labs/FLUX.1-dev",
                "flux-dev": "black-forest-labs/FLUX.1-dev",
                "flux-schnell": "black-forest-labs/FLUX.1-schnell",
                "stable-diffusion-3.5-large": "stabilityai/stable-diffusion-3.5-large",
                "sdxl-1.0": "stabilityai/stable-diffusion-xl-base-1.0",
                "sdxl-turbo": "stabilityai/sdxl-turbo",
                "sd-3.5-large": "stabilityai/stable-diffusion-3.5-large",
            },
            ...options
        });
        this.providerMapping = {
            "google/gemma-3-27b-it": {
                "hf-inference/models/google/gemma-3-27b-it": {
                    "task": "conversational",
                    "providerId": "google/gemma-3-27b-it"
                }
            }
        };
    }

    get models() {
      return {
        list: async () => {
            const response = await fetch("https://huggingface.co/api/models?inference=warm&&expand[]=inferenceProviderMapping");
            if (!response.ok) {
              throw new Error(`Failed to fetch models: ${response.status}`);
            }
            const data = await response.json();
            return data
                .filter(model => 
                    model.inferenceProviderMapping?.some(provider => 
                        provider.status === "live" && provider.task === "conversational"
                    )
                )
                .concat(Object.keys(this.providerMapping).map(model => ({
                    id: model,
                    type: "chat"
                })))
        }
      };
    }

    async _getMapping(model) {
        if (this.providerMapping[model]) {
            return this.providerMapping[model];
        }
        const response = await fetch(`https://huggingface.co/api/models/${model}?expand[]=inferenceProviderMapping`, {
            headers: this.extraHeaders
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch model mapping: ${response.status}`);
        }

        const modelData = await response.json();
        this.providerMapping[model] = modelData.inferenceProviderMapping;
        return this.providerMapping[model];
    }

    get chat() {
        return {
            completions: {
                create: async (params) => {
                    let { model, ...options } = params;

                    if (model && this.modelAliases[model]) {
                      model = this.modelAliases[model];
                    } else if (!model && this.defaultModel) {
                      model = this.defaultModel;
                    }

                    // Model resolution would go here
                    const providerMapping = await this._getMapping(model);
                    if (!providerMapping) {
                        throw new Error(`Model is not supported: ${model}`);
                    }

                    let apiBase = this.apiBase;
                    for (const providerKey in providerMapping) {
                        const apiPath = providerKey === "novita" ? 
                            "novita/v3/openai" : 
                            `${providerKey}/v1`;
                        apiBase = `https://router.huggingface.co/${apiPath}`;

                        const task = providerMapping[providerKey].task;
                        if (task !== "conversational") {
                            throw new Error(`Model is not supported: ${model} task: ${task}`);
                        }

                        model = providerMapping[providerKey].providerId;
                        break;
                    }

                    const requestOptions = {
                        method: 'POST',
                        headers: this.extraHeaders,
                        body: JSON.stringify({
                            model,
                            ...options
                        })
                    };

                    if (params.stream) {
                        return this._streamCompletion(`${apiBase}/chat/completions`, requestOptions);
                    } else {
                        return this._regularCompletion(`${apiBase}/chat/completions`, requestOptions);
                    }
                }
            }
        };
    }
}

export { Client, DeepInfra, Together, Puter, HuggingFace };
export default Client;