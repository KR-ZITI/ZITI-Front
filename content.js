chrome.runtime.onMessage.addListener((message) => {
  console.log("📩 메시지 수신:", message);
  if (message.type === 'showScreenshot') {
    const img = document.createElement('img');
    img.src = message.image;
    img.style.position = 'fixed';
    img.style.top = '50%';
    img.style.left = '50%';
    img.style.transform = 'translate(-50%, -50%) scale(1)';
    img.style.width = '220px';
    img.style.border = '3px solid white';
    img.style.borderRadius = '10px';
    img.style.zIndex = '99999';
    img.style.boxShadow = '0 8px 30px rgba(0,0,0,0.3)';
    img.style.transition = 'transform 1.2s ease-in-out, opacity 1.2s ease-in-out';
    img.style.opacity = '1';
    document.body.appendChild(img);

    // 0.4초 후 애니메이션 시작
    setTimeout(() => {
      // 브라우저 우상단 방향으로 이동 (확장 프로그램 위치 흉내)
      const targetX = window.innerWidth - 24; // 오른쪽 끝 여백
      const targetY = 20;                     // 상단 여백
      const moveX = targetX - window.innerWidth / 2;
      const moveY = targetY - window.innerHeight / 2;

      img.style.transform = `translate(${moveX}px, ${moveY}px) scale(0.05)`;
      img.style.opacity = '0';
    }, 400);

    // 1.8초 후 DOM에서 제거
    setTimeout(() => {
      img.remove();
    }, 1800);
  }
});
