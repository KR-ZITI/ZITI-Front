document.addEventListener("DOMContentLoaded", async () => {
  const accountIcon = document.getElementById("accountIcon");
  const accountDropdown = document.getElementById("accountDropdown");

  if (!accountIcon || !accountDropdown) {
    console.warn("accountIcon 또는 accountDropdown 요소를 찾을 수 없습니다.");
    return;
  }

  let isDropdownOpen = false;

  accountIcon.addEventListener("click", (e) => {
    e.stopPropagation();
    isDropdownOpen = !isDropdownOpen;
    accountDropdown.classList.toggle("show", isDropdownOpen);
  });

  document.addEventListener("click", (e) => {
    if (!accountDropdown.contains(e.target) && !accountIcon.contains(e.target)) {
      isDropdownOpen = false;
      accountDropdown.classList.remove("show");
    }
  });

  const API_URL = 'https://quarrelsome-imojean-beargame-76ebfcd2.koyeb.app';
  // const API_URL = 'http://localhost:9090'

  const uploadOverlay = document.getElementById('uploadOverlay');

  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = themeToggle.querySelector('i');

  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const signupButton = document.getElementById('signupButton');
  const loginButton = document.getElementById('loginButton');
  const logoutButton = document.getElementById('logoutButton');
  const userEmail = document.getElementById('userEmail');
  const authSection = document.getElementById('authSection');
  const userSection = document.getElementById('userSection');

  const chatForm = document.getElementById('chatForm');
  const userInput = document.getElementById('userInput');
  const responseDiv = document.getElementById('response');
  const micButton = document.getElementById('micButton');
  const textModeButton = document.getElementById('textModeButton');
  const realtimeModeButton = document.getElementById('realtimeModeButton');
  const screenshotButton = document.getElementById('screenshotButton');
  const historyToggleButton = document.getElementById('historyToggleButton');
  const chatHistory = document.getElementById('chatHistory');

  let originalResponseHTML = '';
  let isRealtimeMode = false;
  let isListening = false;
  let recognition, socket, silenceTimer, lastTranscript = '';
  const messageHistory = [];

  let pendingImageFile = null;

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
  }

  function updateThemeIcon(theme) {
    if (theme === 'dark') {
      themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
      themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
  }

  themeToggle.addEventListener('click', toggleTheme);
  updateThemeIcon(localStorage.getItem('theme') || 'light');

  accountIcon.addEventListener('click', () => {
    accountDropdown.classList.toggle('show');
  });

  const token = await getValidAccessToken();
  const email = localStorage.getItem('email');
  if (token && email) {
    authSection.style.display = 'none';
    userSection.style.display = 'block';
    userEmail.textContent = email;
  }

  signupButton.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return alert('입력해주세요');

    const res = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    alert(res.ok ? '회원가입 성공' : '회원가입 실패');
  });

  loginButton.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('atk', data.atk);
      localStorage.setItem('rtk', data.rtk);
      localStorage.setItem('email', email);
      authSection.style.display = 'none';
      userSection.style.display = 'block';
      userEmail.textContent = email;
    } else {
      alert('로그인 실패');
    }
  });

  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('atk');
    localStorage.removeItem('rtk');
    localStorage.removeItem('email');
    authSection.style.display = 'block';
    userSection.style.display = 'none';
  });

  textModeButton.addEventListener('click', () => {
    isRealtimeMode = false;
    textModeButton.classList.add('active');
    realtimeModeButton.classList.remove('active');
    if (socket) socket.close();
  });

  realtimeModeButton.addEventListener('click', () => {
    isRealtimeMode = true;
    realtimeModeButton.classList.add('active');
    textModeButton.classList.remove('active');
  });

  let isHistoryVisible = false;

  historyToggleButton.addEventListener('click', () => {
  isHistoryVisible = !isHistoryVisible;

  if (isHistoryVisible) {
    chatHistory.style.display = 'block';
    chatHistory.innerHTML = '';
    loadChatHistoryFromServer();
    responseDiv.innerHTML = ''; // 대화 기록 열 때 기존 응답 제거
  } else {
    chatHistory.style.display = 'none';
    responseDiv.innerHTML = originalResponseHTML; // 복원
  }
});


  function addToHistory(question, answer, createdAt, isFromServer = false) {
  if (!question.trim()) return;
  if (!isFromServer) messageHistory.push(question);

  const item = document.createElement('div');
  item.className = 'chat-history-item';
  item.textContent = question.slice(0, 30) + (question.length > 30 ? '...' : '');

  item.onclick = () => {
    displayAnswerDetail(question, answer, createdAt);
  };

  chatHistory.appendChild(item);
}

function displayAnswerDetail(question, answer, createdAt) {
  responseDiv.innerHTML = '';

  const q = document.createElement('div');
  q.innerHTML = `<strong>Q:</strong> ${question}`;
  q.style.marginBottom = '8px';
  responseDiv.appendChild(q);

  // 👉 기존 displayResponse 사용: 답변만 렌더링
  displayResponse(answer);

  const date = document.createElement('div');
  date.textContent = new Date(createdAt).toLocaleString();
  date.style.fontSize = '0.8em';
  date.style.color = 'gray';
  date.style.marginTop = '8px';
  responseDiv.appendChild(date);
}

  async function loadChatHistoryFromServer() {
  const token = await getValidAccessToken();
    if (!token) return;

  try {
    const res = await fetch(`${API_URL}/api/chatgpt/rest/history`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await res.json();
    console.log(data);
    if (!Array.isArray(data.list)) return;

    data.list.forEach(({ question, answer, createdAt }) => {
      addToHistory(question, answer, createdAt, true); // ✅ 올바른 인자 전달
    });
  } catch (err) {
    console.error('히스토리 불러오기 실패:', err);
  }
}


  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value;
    const token = await getValidAccessToken();
    if (!token) return;
    sendMessage(message, token);
  });

  async function sendMessage(message, token) {
  if (!message.trim() && !pendingImageFile) return;

  try {
    let response;

    if (pendingImageFile) {
      showOverlay('🖼 이미지 분석 중... 잠시만 기다려주세요.');

      const formData = new FormData();
      formData.append('message', message || '이 이미지에 대해 설명해줘');
      formData.append('image', pendingImageFile, pendingImageFile.name || 'uploaded.png');

      response = await fetch(`${API_URL}/api/chatgpt/rest/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
    } else {
      showOverlay('💬 채팅을 분석 중입니다...');

      response = await fetch(`${API_URL}/api/chatgpt/rest/completion/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
    }

    const data = await response.json();

    if (data.messages?.length > 0) {
      displayResponse(data.messages[0].message);
    } else {
      responseDiv.textContent = 'ChatGPT 응답이 비어 있습니다.';
    }
  } catch (err) {
    responseDiv.textContent = '❌ 오류 발생: ' + err.message;
  } finally {
    userInput.value = '';
    pendingImageFile = null;
    hideOverlay();
  }
}

  function displayResponse(message) {
  responseDiv.innerHTML = '';
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0, match;

  while ((match = codeRegex.exec(message)) !== null) {
    responseDiv.appendChild(document.createTextNode(message.slice(lastIndex, match.index)));
    const codeBlock = document.createElement('div');
    codeBlock.className = 'code-block';

    const language = match[1] || 'plaintext';
    const code = match[2].trim();

    const languageLabel = document.createElement('div');
    languageLabel.className = 'language-label';
    languageLabel.textContent = language;
    codeBlock.appendChild(languageLabel);

    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.className = `language-${language}`;
    codeElement.textContent = code;
    pre.appendChild(codeElement);
    codeBlock.appendChild(pre);

    const copyButton = document.createElement('button');
    copyButton.className = 'copy-button';
    copyButton.textContent = '복사';
    copyButton.onclick = () => {
      navigator.clipboard.writeText(code).then(() => {
        copyButton.textContent = '복사됨!';
        setTimeout(() => { copyButton.textContent = '복사'; }, 2000);
      });
    };
    codeBlock.appendChild(copyButton);
    responseDiv.appendChild(codeBlock);
    lastIndex = codeRegex.lastIndex;
  }

  const remainingText = convertMarkdownToHTML(message.slice(lastIndex));

  const wrapper = document.createElement('div');
  wrapper.innerHTML = remainingText;
  responseDiv.appendChild(wrapper);

  // ✅ 오버레이 종료 시점
  hideOverlay();

  document.querySelectorAll('pre code').forEach((block) => {
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(block);
    }
  });
}
  function convertMarkdownToHTML(markdown) {
    return markdown
      .replace(/→/g, '⇒')
      .replace(/^###\s*(.+)$/gm, '<h3>$1</h3>')                 // 제목 (###)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')         // 볼드 (**텍스트**)
      .replace(/^- (.+)$/gm, '<li>$1</li>')                     // 리스트 항목 (- 항목)
      .replace(/(<li>.+<\/li>)/gs, '<ul>$1</ul>')               // li들을 <ul>로 감싸기
      .replace(/([^\n.!?]+[.!?])/g, '<p>$1</p>');               // 일반 문장 <p>
  }

  function initSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    micButton.style.display = 'none';
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'ko-KR';

  recognition.onresult = async function (event) {
  let interimTranscript = '', finalTranscript = '';
  for (let i = event.resultIndex; i < event.results.length; ++i) {
    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
    else interimTranscript += event.results[i][0].transcript;
  }

  const currentTranscript = finalTranscript || interimTranscript;
  userInput.value = currentTranscript;

  if (/(스크린샷|스샷)\s*$/i.test(currentTranscript.trim())) {
    const cleaned = currentTranscript.replace(/(스크린샷|스샷)\s*$/ig, '').trim() || '이 이미지에 대해 설명해줘';
    userInput.value = cleaned;
    recognition.stop();
    setTimeout(() => screenshotButton.click(), 300);
    lastTranscript = '';
    clearTimeout(silenceTimer);
    return;
  }

  if (currentTranscript !== lastTranscript) {
    lastTranscript = currentTranscript;
    clearTimeout(silenceTimer);

    silenceTimer = setTimeout(async () => {
      if (isRealtimeMode) {
        const token = await getValidAccessToken(); // ✅ 여기 변경
        if (token) sendMessage(currentTranscript, token);
      }
    }, 3000);
  }
};


  recognition.onend = async () => {
    micButton.classList.remove('listening');
    isListening = false;
    const token = await getValidAccessToken();

    // WebSocket 종료
    if (isRealtimeMode && socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }

    if (!isRealtimeMode && userInput.value.trim() && token) {
      sendMessage(userInput.value, token);
    }
  };


  recognition.onerror = (event) => {
    console.error('음성 인식 오류:', event.error);
    micButton.classList.remove('listening');
    isListening = false;
  };
}

async function startVoiceRecognition() {
  if (!recognition) return;
  if (isListening) return recognition.stop();

  micButton.classList.add('listening');
  isListening = true;
  userInput.value = '';
  recognition.start();

  const token = await getValidAccessToken();
  if (isRealtimeMode && token) {
    socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/chat/stream?token=${token}`);
    socket.onopen = () => console.log('WebSocket 연결 성공');
    socket.onmessage = (event) => {
      responseDiv.textContent += event.data;
    };
    socket.onerror = (error) => console.error('WebSocket 오류:', error);
    socket.onclose = () => console.log('WebSocket 연결 종료');
  }
}

micButton.addEventListener('click', async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    startVoiceRecognition();
  } catch (err) {
    console.log('❌ 마이크 권한 요청 실패: ' + err.message);
  }
});

screenshotButton.addEventListener('click', async () => {
  const token = await getValidAccessToken();
  if (!token) return alert('로그인 후 이용해주세요.');

  chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
    const blob = dataURLtoBlob(dataUrl);
    pendingImageFile = blob;

    previewImage(blob); // ✅ 추가해야 미리보기가 작동함

    alert('🖼 스크린샷이 준비되었습니다. 질문과 함께 전송하세요.');
  });
});

function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

async function getValidAccessToken() {
  let token = localStorage.getItem('atk');
  const refreshToken = localStorage.getItem('rtk');
  const email = localStorage.getItem('email');

  // 토큰 유효성 검사
  if (token) {
    const payload = parseJwt(token);
    const now = Math.floor(Date.now() / 1000);

    if (payload && payload.exp > now + 10) {
      // 유효 시간 10초 이상 남았으면 그대로 사용
      return token;
    }
  }

  // 재발급 조건: refreshToken과 email이 있어야 함
  if (!refreshToken || !email) {
    alert('로그인이 필요합니다.');
    return null;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/reissue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rtk: refreshToken, email })
    });

    if (!res.ok) throw new Error('재발급 실패');

    const data = await res.json();
    localStorage.setItem('atk', data.atk);
    return data.atk;
  } catch (err) {
    console.error('access token 재발급 실패:', err.message);
    alert('세션이 만료되었습니다. 다시 로그인해주세요.');
    localStorage.removeItem('atk');
    localStorage.removeItem('rtk');
    localStorage.removeItem('email');
    authSection.style.display = 'block';
    userSection.style.display = 'none';
    return null;
  }
}

document.getElementById('openFullPage').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('fullpage.html')
  });
});

document.addEventListener('paste', handlePasteOrDrop);
document.addEventListener('drop', handlePasteOrDrop);
document.addEventListener('dragover', (e) => e.preventDefault());

function showOverlay(text = '🖼 이미지 분석 중... 잠시만 기다려주세요.') {
  if (!uploadOverlay) return;
  const msg = uploadOverlay.querySelector('.upload-message');
  if (msg) msg.textContent = text;
  uploadOverlay.style.display = 'flex';
}

function hideOverlay() {
  if (uploadOverlay) uploadOverlay.style.display = 'none';
}


function handlePasteOrDrop(event) {
  event.preventDefault();
  const items = event.clipboardData?.items || event.dataTransfer?.items;
  if (!items) return;

  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        showOverlay();
        pendingImageFile = file;
        previewImage(file);  // 사용자에게 미리 보여줄 수 있음 (옵션)
        hideOverlay();
        break;
      }
    }
  }
}

async function uploadImageFile(file) {
  const token = await getValidAccessToken();
  if (!token) return alert('로그인 후 이용해주세요.');

  // ❌ showOverlay(); <= 여기 제거

  const formData = new FormData();
  formData.append('image', file, 'uploaded.png');
  formData.append('message', userInput.value || '이 이미지에 대해 설명해줘');

  try {
    const res = await fetch(`${API_URL}/api/chatgpt/rest/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();

    const reader = new FileReader();
    reader.onload = function () {
      const dataUrl = reader.result;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'showScreenshot',
          image: dataUrl
        });
      });
    };
    reader.readAsDataURL(file);

    if (data.messages?.length > 0) {
      displayResponse(data.messages[0].message); // ✅ 이 안에서 hideOverlay() 됨
    } else {
      responseDiv.textContent = 'ChatGPT 응답이 비어 있습니다.';
      hideOverlay(); // ✅ 예외 경우에도 수동 제거
    }
  } catch (err) {
    alert('❌ 이미지 업로드 실패: ' + err.message);
    hideOverlay(); // ✅ 예외 발생 시에도 제거
  }
}

function previewImage(file) {
  const reader = new FileReader();
  reader.onload = function () {
    const dataUrl = reader.result;
    console.log('🖼 미리보기 URL:', dataUrl);  // ✅ 확인
    const preview = document.getElementById('imagePreview');
    if (preview) {
      preview.src = dataUrl;
      preview.style.display = 'block';
    } else {
      console.warn('⚠️ imagePreview 요소 없음');
    }
  };
  reader.readAsDataURL(file);
}

initSpeechRecognition();
originalResponseHTML = responseDiv.innerHTML;
}); 