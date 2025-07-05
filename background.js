async function toggleIframe(tabId) {
  if (!tabId) return;

  const key = `uiOpen_${tabId}`;
  const storageData = await chrome.storage.local.get([key]);
  const uiOpen = storageData[key] ?? false;

  if (!uiOpen) {
    // 注入 iframe
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await chrome.storage.local.set({ [key]: true });
  } else {
    // 关闭 iframe
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const iframe = document.getElementById('g4f-iframe');
        if (iframe) iframe.remove();
      }
    });
    await chrome.storage.local.set({ [key]: false });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openG4FMedia',
    title: 'Open AI Media Generator',
    contexts: ['all']
  });
});

// 点击扩展图标
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await toggleIframe(tab.id);
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'openG4FMedia') {
    if (!tab.id) return;
    await toggleIframe(tab.id);
  }
});

// 监听从 content 发送的关闭消息，更新状态
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'closeIframe' && sender.tab?.id) {
    const key = `uiOpen_${sender.tab.id}`;
    chrome.storage.local.set({ [key]: false });
  }
});
