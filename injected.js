// 关闭按钮事件
document.getElementById('closeBtn').onclick = () => {
  window.parent.postMessage({ action: 'closeIframe' }, '*');
};

import Client from './g4f-client.js';

marked.setOptions({
  highlight: (code, lang) => {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

const client = new Client();
const entries = document.getElementById('entries');
// document.getElementById('addBtn').onclick = () => entries.append(createEntry());
entries.append(createEntry());

function createEntry() {
  const div = document.createElement('div');
  div.className = 'entry';
  div.innerHTML = `
    <textarea placeholder="Enter prompt"></textarea>
    <select>
      <option value="chat">Text 📝</option>
      <option value="image">Image 🖼️</option>
    </select>
    <select class="modelSelect"></select>

    <!-- 额外的 image 参数输入框，默认隐藏 -->
    <div class="image-params" style="display:none; margin-top:8px; gap:8px; align-items:center; font-size:14px;">
      <label>Width: <input type="number" min="1" value="512" style="width:60px;"></label>
      <label>Height: <input type="number" min="1" value="512" style="width:60px;"></label>
      <label>N: <input type="number" min="1" max="10" value="1" style="width:40px;"></label>
    </div>

    <button>Generate</button><span class="loading" style="display:none">🔄 Generating...</span>
    <div class="media"></div>
  `;

  const [txt, mode, msel, imageParamsDiv, btn, load, media] = div.children;

  // 监听模式切换，显示或隐藏额外参数
  mode.onchange = () => {
    loadModels(mode.value, msel);
    if (mode.value === 'image') {
      imageParamsDiv.style.display = 'flex';
    } else {
      imageParamsDiv.style.display = 'none';
    }
  };
  // 初始调用加载模型和切换显示
  loadModels('chat', msel);
  imageParamsDiv.style.display = 'none';

  btn.onclick = async () => {
    const prompt = txt.value.trim();
    if (!prompt) return alert('prompt required');
    btn.disabled = true;
    load.style.display = 'inline';
    media.innerHTML = '';
    try {
      const mdl = msel.value;
      let res;

      if (mode.value === 'chat') {
        res = await client.chat.completions.create({ model: mdl, messages: [{ role: 'user', content: prompt }] });
      } else if (mode.value === 'image') {
        // 取出 width, height, n
        const width = parseInt(imageParamsDiv.children[0].querySelector('input').value) || 512;
        const height = parseInt(imageParamsDiv.children[1].querySelector('input').value) || 512;
        const n = parseInt(imageParamsDiv.children[2].querySelector('input').value) || 1;

        const size = `${width}x${height}`;

        res = await client.images.generate({ model: mdl, prompt, size, n });
      }

      const url = res.data?.[0]?.url || res.choices?.[0]?.message?.content;
      if (!url) throw new Error('No result');

      if (mode.value === 'chat') {
        const html = marked.parse(url);
        media.innerHTML = html;

        const codeBlocks = media.querySelectorAll('pre > code');
        codeBlocks.forEach(codeBlock => {
          const pre = codeBlock.parentElement;
          const btnCopy = document.createElement('button');
          btnCopy.textContent = 'Copy';
          btnCopy.className = 'copy-code-btn';
          btnCopy.style.cssText = `
            position: absolute;
            right: 8px;
            top: 8px;
            padding: 2px 6px;
            font-size: 12px;
            cursor: pointer;
          `;
          pre.style.position = 'relative';
          btnCopy.onclick = () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
              btnCopy.textContent = 'Copied!';
              setTimeout(() => (btnCopy.textContent = 'Copy'), 2000);
            });
          };
          pre.appendChild(btnCopy);
        });
      } else if (mode.value === 'image') {
        // url是数组时，显示所有图片
        if (Array.isArray(res.data)) {
          res.data.forEach(imgData => {
            const el = document.createElement('img');
            el.src = imgData.url;
            el.className = 'media';
            el.style.maxWidth = '100%';
            el.style.height = 'auto';
            media.append(el);
          });
        } else {
          const el = document.createElement('img');
          el.src = url;
          el.className = 'media';
          el.style.maxWidth = '100%';
          el.style.height = 'auto';
          media.append(el);
        }
        // 下载按钮
        const dl = document.createElement('a');
        dl.textContent = `Download ${mode.value}`;
        dl.className = 'download';
        dl.style.display = 'inline-block';
        dl.style.marginTop = '8px';
        dl.style.cursor = 'pointer';

        dl.onclick = async (e) => {
          e.preventDefault();
          try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `out_${mode.value}_${Date.now()}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
          } catch (err) {
            alert('Download failed: ' + err.message);
          }
        };

        media.append(dl);
      }
    } catch (e) {
      media.textContent = '❌ Error: ' + e.message;
      console.error(e);
    } finally {
      load.style.display = 'none';
      btn.disabled = false;
    }
  };
  return div;
}

async function loadModels(type, sel) {
  sel.innerHTML = '';
  const map = {
    chat: ['gpt-4.1-mini','gpt-4.1-nano','gpt-4','gpt-4o','gpt-4o-mini','glm-4','gemini-1.5-pro','gemini-1.5-flash','sonar-pro','sonar-reasoning','sonar-reasoning-pro','o1','o3-mini','blackboxai','llama-2-7b','llama-3-8b','llama-3.1-70b','llama-3.1-8b','llama-3.2-1b','qwen-1.5-7b','deepseek-prover-v2-671b','deepseek-v3-0324','deepseek-r1-distill-qwen-32b'],
    image: ['flux', 'flux-dev', 'flux-pro', 'flux-schnell','flux-redux','flux-depth','flux-canny','flux-kontext-max','flux-dev-lora','flux-kontext-pro', 'gpt-image', 'sdxl-1.0', 'sdxl-l', 'sdxl-turbo','sd-3.5-large','dall-e-3'],
  };
  map[type].forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    sel.append(o);
  });
}
