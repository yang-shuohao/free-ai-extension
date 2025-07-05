if (!document.getElementById('g4f-iframe')) {
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('injected.html');
  iframe.id = 'g4f-iframe';
  Object.assign(iframe.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    width: '600px',
    height: '100vh',
    border: 'none',
    zIndex: '2147483647',
  });
  document.body.appendChild(iframe);
}

// 监听关闭消息，移除 iframe 并通知 background
window.addEventListener('message', (event) => {
  if (event.data?.action === 'closeIframe') {
    const iframe = document.getElementById('g4f-iframe');
    if (iframe) iframe.remove();
    // 通知 background 更新状态
    chrome.runtime.sendMessage({ action: 'closeIframe' });
  }
});
