const themeToggle = document.getElementById('themeToggle');
const themeIcon = themeToggle.querySelector('i');

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  if (theme === 'dark') {
    themeIcon.classList.remove('fa-moon');
    themeIcon.classList.add('fa-sun');
  } else {
    themeIcon.classList.remove('fa-sun');
    themeIcon.classList.add('fa-moon');
  }
}

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);
themeToggle.addEventListener('click', toggleTheme);

const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const responseDiv = document.getElementById('response');
const micButton = document.getElementById('micButton');
const textModeButton = document.getElementById('textModeButton');
const realtimeModeButton = document.getElementById('realtimeModeButton');
const screenshotButton = document.getElementById('screenshotButton');

let isListening = false;
let recognition;
let isRealtimeMode = false;
let socket;
let silenceTimer;
let lastTranscript = '';

function initSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    console.log("❌ 이 브라우저는 음성 인식을 지원하지 않습니다.");
    micButton.style.display = 'none';
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'ko-KR';

  recognition.onresult = function (event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const currentTranscript = finalTranscript || interimTranscript;
    userInput.value = currentTranscript;

    if (currentTranscript !== lastTranscript) {
      lastTranscript = currentTranscript;
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (isRealtimeMode) {
          sendMessage(currentTranscript);
        }
      }, 3000);
    }
  };

  recognition.onend = () => {
    micButton.classList.remove('listening');
    isListening = false;
    if (!isRealtimeMode && userInput.value.trim()) {
      sendMessage(userInput.value);
    }
  };

  recognition.onerror = (event) => {
    console.error('음성 인식 오류:', event.error);
    micButton.classList.remove('listening');
    isListening = false;
  };
}

function startVoiceRecognition() {
  if (!recognition) return;

  if (isListening) {
    recognition.stop();
    return;
  }

  micButton.classList.add('listening');
  isListening = true;
  userInput.value = '';
  recognition.start();

  if (isRealtimeMode) {
    socket = new WebSocket('ws://localhost:9090/chat/stream');
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
    alert("❌ 마이크 권한 요청 실패: " + err.message);
  }
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

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  sendMessage(userInput.value);
});

async function sendMessage(message) {
  if (!message.trim()) return;
  responseDiv.textContent = '응답을 기다리는 중...';

  try {
    const gptResponse = await fetch('http://localhost:9090/api/chatgpt/rest/completion/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message })
    });

    if (!gptResponse.ok) throw new Error('ChatGPT 서버 응답 오류');

    const gptData = await gptResponse.json();
    if (gptData.messages?.length > 0) {
      const gptMessage = gptData.messages[0].message;
      displayResponse(gptMessage);
    } else {
      responseDiv.textContent = 'messages 필드를 찾을 수 없습니다.';
    }
  } catch (error) {
    responseDiv.textContent = '오류 발생: ' + error.message;
    console.error(error);
  }

  userInput.value = '';
}

function displayResponse(message) {
  responseDiv.innerHTML = '';
  const codeRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

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
        setTimeout(() => {
          copyButton.textContent = '복사';
        }, 2000);
      });
    };
    codeBlock.appendChild(copyButton);
    responseDiv.appendChild(codeBlock);

    lastIndex = codeRegex.lastIndex;
  }

  responseDiv.appendChild(document.createTextNode(message.slice(lastIndex)));
  document.querySelectorAll('pre code').forEach((block) => {
    if (typeof hljs !== 'undefined') {
      hljs.highlightElement(block);
    }
  });
}

screenshotButton.addEventListener('click', () => {
  chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      alert('스크린샷 실패: ' + chrome.runtime.lastError.message);
      return;
    }

    const blob = dataURLtoBlob(dataUrl);
    const formData = new FormData();
    formData.append('screenshot', blob, 'screenshot.png');

    fetch('http://localhost:9090/api/upload', {
      method: 'POST',
      body: formData
    })
      .then((res) => res.text())
      .then((result) => {
        alert('✅ 업로드 성공: ' + result);
      })
      .catch((err) => {
        alert('❌ 업로드 실패: ' + err.message);
      });
  });
});

function dataURLtoBlob(dataUrl) {
  const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1],
    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new Blob([u8arr], { type: mime });
}

// 초기화
initSpeechRecognition();